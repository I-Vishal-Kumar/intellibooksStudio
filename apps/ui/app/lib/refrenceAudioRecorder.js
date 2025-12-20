// Live Recording Functionality with WAV Encoding
class LiveRecordingManager {
    constructor() {
        this.audioContext = null;
        this.mediaStream = null;
        this.processor = null;
        this.recordingSession = null;
        this.chunkIndex = 0;
        this.transcriptUpdateInterval = null;
        this.audioBuffer = [];
        this.bufferSize = 4096;
        this.sampleRate = 16000; // Whisper native sample rate
        this.chunkDuration = 10; // Increased to 10 seconds as requested
        this.samplesPerChunk = this.sampleRate * this.chunkDuration;
        this.isRecording = false;

        // Queue for serializing uploads
        this.chunkQueue = [];
        this.isUploading = false;

        this.startBtn = document.getElementById('startRecordingBtn');
        this.stopBtn = document.getElementById('stopRecordingBtn');
        this.statusDiv = document.getElementById('recordingStatus');
        this.transcriptDiv = document.getElementById('liveTranscript');
        this.transcriptText = document.getElementById('transcriptText');

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.startBtn.addEventListener('click', () => this.startRecording());
        this.stopBtn.addEventListener('click', () => this.stopRecording());
    }

    async startRecording() {
        try {
            // Request microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Start recording session on server
            const response = await fetch('/recording/start', {
                method: 'POST'
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error);
            }

            this.recordingSession = result.session;
            this.chunkIndex = 0;
            this.audioBuffer = [];
            this.chunkQueue = [];
            this.isUploading = false;
            this.isRecording = true;

            // Initialize AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate
            });

            const source = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Use ScriptProcessor for wide compatibility (AudioWorklet is better but more complex to setup with single file)
            this.processor = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);

            source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);

            this.processor.onaudioprocess = (e) => {
                // Strictly check if we are still recording
                if (!this.isRecording || !this.recordingSession) return;

                const inputData = e.inputBuffer.getChannelData(0);
                // Clone data to avoid reference issues
                const pcmData = new Float32Array(inputData);
                this.audioBuffer.push(pcmData);

                // Check if we have enough data for a chunk
                const currentLength = this.audioBuffer.reduce((acc, chunk) => acc + chunk.length, 0);
                if (currentLength >= this.samplesPerChunk) {
                    this.processBuffer();
                }
            };

            this.updateUIForRecording();
            this.startTranscriptPolling();

        } catch (error) {
            this.showNotification('Failed to start recording: ' + error.message, 'error');
            console.error('Recording start error:', error);
            this.isRecording = false;
        }
    }

    processBuffer() {
        if (this.audioBuffer.length === 0) return;

        // Flatten buffer
        const totalLength = this.audioBuffer.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Float32Array(totalLength);
        let offset = 0;
        for (const chunk of this.audioBuffer) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        // Clear buffer immediately so new data can start accumulating (if we were still recording)
        // But since processBuffer is async, we should be careful.
        // In our case, we only call this when full or stopping.
        this.audioBuffer = [];

        // Convert to 16-bit PCM
        const pcm16 = this.floatTo16BitPCM(result);

        // Add WAV header
        const wavBytes = this.addWAVHeader(pcm16);

        // Create blob and send
        const blob = new Blob([wavBytes], { type: 'audio/wav' });

        // Add to queue with current index
        this.chunkQueue.push({
            blob: blob,
            index: this.chunkIndex
        });

        // Increment index immediately for the next chunk
        this.chunkIndex++;

        // Trigger queue processing
        this.processQueue();
    }

    async processQueue() {
        if (this.isUploading || this.chunkQueue.length === 0) return;

        this.isUploading = true;

        try {
            while (this.chunkQueue.length > 0) {
                const item = this.chunkQueue.shift();
                await this.sendChunk(item.blob, item.index);
            }
        } catch (error) {
            console.error('Queue processing error:', error);
        } finally {
            this.isUploading = false;
            // Check if more items were added while we were processing
            if (this.chunkQueue.length > 0) {
                this.processQueue();
            }
        }
    }

    floatTo16BitPCM(input) {
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return output;
    }

    addWAVHeader(samples) {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        // RIFF chunk descriptor
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + samples.length * 2, true);
        this.writeString(view, 8, 'WAVE');

        // fmt sub-chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
        view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
        view.setUint16(22, 1, true); // NumChannels (1 for Mono)
        view.setUint32(24, this.sampleRate, true); // SampleRate
        view.setUint32(28, this.sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
        view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
        view.setUint16(34, 16, true); // BitsPerSample

        // data sub-chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, samples.length * 2, true);

        // Write samples
        const sampleBytes = new Int16Array(buffer, 44);
        sampleBytes.set(samples);

        return buffer;
    }

    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    async sendChunk(audioBlob, index) {
        if (!this.recordingSession) return;

        try {
            const formData = new FormData();
            formData.append('audio_chunk', audioBlob, `chunk_${index}.wav`);
            formData.append('chunk_index', index.toString());

            const response = await fetch(`/recording/${this.recordingSession.session_id}/chunk`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (response.ok) {
                console.log(`Chunk ${index} processed:`, result);
            } else {
                console.error(`Chunk ${index} processing failed:`, result.error);
            }

        } catch (error) {
            console.error(`Failed to send chunk ${index}:`, error);
        }
    }

    async stopRecording() {
        if (!this.isRecording) return;

        try {
            // 1. Stop accepting new data immediately
            this.isRecording = false;

            // 2. Show loading state
            this.updateUIForStopping();

            // 3. Stop capturing audio hardware
            if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
            }

            // 4. Disconnect audio processing nodes
            if (this.processor) {
                this.processor.disconnect();
                this.processor = null;
            }
            if (this.audioContext) {
                await this.audioContext.close();
                this.audioContext = null;
            }

            // 5. Stop polling for transcripts
            if (this.transcriptUpdateInterval) {
                clearInterval(this.transcriptUpdateInterval);
            }

            // 6. Process whatever is left in the buffer
            // This adds the final chunk to the queue
            if (this.audioBuffer.length > 0) {
                console.log('Processing final buffer...');
                this.processBuffer();
            }

            // 7. Wait for queue to drain
            console.log('Waiting for uploads to complete...');
            while (this.chunkQueue.length > 0 || this.isUploading) {
                this.statusDiv.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Finalizing... (${this.chunkQueue.length + (this.isUploading ? 1 : 0)} chunks remaining)`;
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // 8. Finally, tell backend to stop the session
            if (this.recordingSession) {
                console.log('Stopping session on server...');
                const response = await fetch(`/recording/${this.recordingSession.session_id}/stop`, {
                    method: 'POST'
                });

                const result = await response.json();
                if (response.ok) {
                    this.showNotification('Recording completed! Final transcription saved.', 'success');
                    // Reload to show the new transcription in the list
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);
                } else {
                    this.showNotification('Error stopping recording: ' + result.error, 'error');
                    this.resetUI(); // Reset UI if error so user isn't stuck
                }
            } else {
                this.resetUI();
            }

        } catch (error) {
            this.showNotification('Failed to stop recording: ' + error.message, 'error');
            console.error('Recording stop error:', error);
            this.resetUI();
        }
    }

    startTranscriptPolling() {
        this.transcriptUpdateInterval = setInterval(() => {
            this.updateTranscript();
        }, 2000);
    }

    async updateTranscript() {
        if (!this.recordingSession) return;

        try {
            const response = await fetch(`/recording/${this.recordingSession.session_id}/transcript`);
            const result = await response.json();

            if (response.ok) {
                const transcript = result.transcript || 'Listening...';
                this.transcriptText.textContent = transcript;

                // Auto-scroll to bottom
                this.transcriptText.parentElement.scrollTop = this.transcriptText.parentElement.scrollHeight;
            }
        } catch (error) {
            console.error('Failed to update transcript:', error);
        }
    }

    updateUIForRecording() {
        this.startBtn.classList.add('hidden');
        this.stopBtn.classList.remove('hidden');
        this.statusDiv.classList.remove('hidden');
        this.statusDiv.textContent = 'Recording...';
        this.transcriptDiv.classList.remove('hidden');
        this.transcriptText.textContent = 'Listening...';
    }

    updateUIForStopping() {
        this.startBtn.classList.add('hidden');
        this.stopBtn.classList.add('hidden');
        this.statusDiv.classList.remove('hidden');
        this.statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Finalizing transcription...';
    }

    resetUI() {
        this.startBtn.classList.remove('hidden');
        this.stopBtn.classList.add('hidden');
        this.statusDiv.classList.add('hidden');
        this.transcriptDiv.classList.add('hidden');
        this.recordingSession = null;
        this.isRecording = false;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transition-all duration-300 ${type === 'error' ? 'bg-red-500 text-white' :
            type === 'success' ? 'bg-green-500 text-white' :
                'bg-blue-500 text-white'
            }`;

        notification.innerHTML = `
            <div class="flex items-center">
                <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'} mr-2"></i>
                <span>${message}</span>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new LiveRecordingManager();
});