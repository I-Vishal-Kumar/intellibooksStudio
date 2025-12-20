import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Create axios instance with default config
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    // const token = getAuthToken();
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    // Handle common errors
    if (error.response) {
      // Server responded with error status
      switch (error.response.status) {
        case 401:
          // Handle unauthorized
          break;
        case 403:
          // Handle forbidden
          break;
        case 404:
          // Handle not found
          break;
        case 500:
          // Handle server error
          break;
      }
    } else if (error.request) {
      // Request made but no response received
      console.error("Network error:", error.request);
    } else {
      // Something else happened
      console.error("Error:", error.message);
    }
    return Promise.reject(error);
  }
);

// Helper function for file uploads
export const uploadFile = async (
  file: File,
  endpoint: string,
  onUploadProgress?: (progress: number) => void
) => {
  const formData = new FormData();
  formData.append("file", file);

  const config: AxiosRequestConfig = {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onUploadProgress) {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onUploadProgress(progress);
      }
    },
  };

  return apiClient.post(endpoint, formData, config);
};

/**
 * Transcribe audio file using Gemini via OpenRouter
 * @param audioBlob - Audio blob (WAV or WebM format)
 * @returns Transcribed text
 */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.wav");

  const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:8004";
  
  const response = await axios.post(
    `${websocketUrl}/api/transcription/transcribe`,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 60000, // 60 seconds for transcription
    }
  );

  if (response.data.success && response.data.text) {
    return response.data.text;
  } else {
    throw new Error(response.data.error || "Transcription failed");
  }
}

// Export default instance
export default apiClient;

