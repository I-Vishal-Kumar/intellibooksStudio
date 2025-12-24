import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    Panel,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    MarkerType,
    Position,
    Handle,
    NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Maximize2, Download, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight, Plus, Minus, Move } from "lucide-react";

// --- Custom Node Component ---
const MindMapNode = ({ data }: NodeProps) => {
    const { label, color, isExpanded, hasChildren, onToggle, direction } = data as any;

    return (
        <div className="relative group">
            {hasChildren && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                    }}
                    className={`absolute ${direction === "left" ? "-left-6" : "-right-6"} top-1/2 -translate-y-1/2 w-5 h-5 bg-white border border-gray-200 rounded-full flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors z-[100] shadow-sm cursor-pointer`}
                >
                    {isExpanded ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
                </button>
            )}

            <div className={`${color} px-4 py-2 rounded-xl shadow-md border border-black/5 min-w-[150px] flex items-center justify-center text-sm font-semibold text-gray-800 transition-all hover:scale-105 hover:shadow-lg`}>
                {label}
            </div>

            {/* Handles */}
            <Handle type="target" position={direction === "right" ? Position.Left : Position.Right} className="opacity-0" />
            <Handle type="source" position={direction === "right" ? Position.Right : Position.Left} className="opacity-0" />
        </div>
    );
};

const nodeTypes = {
    mindmap: MindMapNode,
};

interface ArchitectureViewProps {
    onClose?: () => void;
    onExpand?: () => void;
    isModal?: boolean;
}

const ArchitectureView: React.FC<ArchitectureViewProps> = ({ onClose, onExpand, isModal = true }) => {
    // ... rest remains same
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root', 'platform']));

    const toggleExpand = (nodeId: string) => {
        setExpandedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    };

    const getNodes = () => {
        const nodes = [
            {
                id: 'root',
                type: 'mindmap',
                position: { x: 0, y: 0 },
                data: {
                    label: 'jAI Agent Framework',
                    color: 'bg-[#ced4ff]',
                    hasChildren: true,
                    isExpanded: expandedNodes.has('root'),
                    onToggle: () => toggleExpand('root'),
                    direction: 'right'
                },
            },
        ];

        if (expandedNodes.has('root')) {
            nodes.push(
                {
                    id: 'platform',
                    type: 'mindmap',
                    position: { x: 250, y: -100 },
                    data: {
                        label: 'Platform Overview',
                        color: 'bg-[#bfdbfe]',
                        hasChildren: true,
                        isExpanded: expandedNodes.has('platform'),
                        onToggle: () => toggleExpand('platform'),
                        direction: 'right'
                    },
                },
                {
                    id: 'characteristics',
                    type: 'mindmap',
                    position: { x: 250, y: -20 },
                    data: { label: '13 Core Characteristics', color: 'bg-[#bfdbfe]', hasChildren: true, direction: 'right', onToggle: () => { }, isExpanded: false },
                },
                {
                    id: 'domain',
                    type: 'mindmap',
                    position: { x: 250, y: 60 },
                    data: { label: 'Domain Configurations', color: 'bg-[#bfdbfe]', hasChildren: true, direction: 'right', onToggle: () => { }, isExpanded: false },
                },
                {
                    id: 'implementation',
                    type: 'mindmap',
                    position: { x: 250, y: 140 },
                    data: { label: 'Implementation & Architecture', color: 'bg-[#bfdbfe]', hasChildren: true, direction: 'right', onToggle: () => { }, isExpanded: false },
                }
            );
        }

        if (expandedNodes.has('root') && expandedNodes.has('platform')) {
            nodes.push(
                {
                    id: 'ent_ai',
                    type: 'mindmap',
                    position: { x: 500, y: -160 },
                    data: { label: 'Enterprise AI Agents', color: 'bg-[#bbf7d0]', direction: 'right' },
                },
                {
                    id: 'key_diff',
                    type: 'mindmap',
                    position: { x: 500, y: -100 },
                    data: { label: 'Key Differentiators', color: 'bg-[#bbf7d0]', direction: 'right' },
                },
                {
                    id: 'target_out',
                    type: 'mindmap',
                    position: { x: 500, y: -40 },
                    data: { label: 'Target Outcomes', color: 'bg-[#bbf7d0]', direction: 'right' },
                }
            );
        }

        return nodes;
    };

    const getEdges = () => {
        const edges: Edge[] = [];

        if (expandedNodes.has('root')) {
            ['platform', 'characteristics', 'domain', 'implementation'].forEach(target => {
                edges.push({
                    id: `e-root-${target}`,
                    source: 'root',
                    target: target,
                    animated: false,
                    style: { stroke: '#cbd5e1', strokeWidth: 2 },
                    type: 'smoothstep',
                });
            });
        }

        if (expandedNodes.has('root') && expandedNodes.has('platform')) {
            ['ent_ai', 'key_diff', 'target_out'].forEach(target => {
                edges.push({
                    id: `e-platform-${target}`,
                    source: 'platform',
                    target: target,
                    animated: false,
                    style: { stroke: '#cbd5e1', strokeWidth: 2 },
                    type: 'smoothstep',
                });
            });
        }

        return edges;
    };

    const initialNodes = useMemo(() => getNodes(), [expandedNodes]);
    const initialEdges = useMemo(() => getEdges(), [expandedNodes]);

    return (
        <div className={isModal ? "fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm p-8" : "w-full h-full flex flex-col bg-white overflow-hidden p-4"}>
            <div className={isModal ? "w-full h-full bg-white border border-gray-200 rounded-[32px] flex flex-col relative overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300" : "flex-1 flex flex-col relative"}>

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-50 bg-white/50 backdrop-blur-sm z-20">
                    <div className="space-y-1">
                        {!isModal && (
                            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">
                                <span className="cursor-pointer hover:text-gray-900 transition-colors">Studio</span>
                                <span>&gt;</span>
                                <span className="text-gray-900">App</span>
                            </div>
                        )}
                        <h2 className={`${isModal ? 'text-xl' : 'text-sm'} font-semibold text-gray-800 tracking-tight truncate max-w-[200px] lg:max-w-none`}>
                            {isModal ? 'The jAI Agent Framework: Architecture and Domain Implementation' : 'Architecture Mind Map'}
                        </h2>
                        <p className="text-[10px] text-gray-400 font-medium">Based on 1 source</p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onExpand}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <Maximize2 size={isModal ? 18 : 16} />
                        </button>
                        {isModal && (
                            <>
                                <button className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                                    <Download size={18} />
                                </button>
                                <button
                                    onClick={onClose}
                                    className="ml-4 w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 hover:text-gray-900 transition-all font-light text-xl"
                                >
                                    ×
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Mind Map Canvas with React Flow */}
                <div className="flex-1 relative bg-[#fcfcfc]">
                    <ReactFlow
                        nodes={initialNodes}
                        edges={initialEdges}
                        nodeTypes={nodeTypes}
                        fitView
                        minZoom={0.2}
                        maxZoom={2}
                        className="cursor-grab active:cursor-grabbing"
                        colorMode="light"
                    >
                        <Background color="#f1f5f9" gap={20} />
                        <Controls showInteractive={false} className="bg-white border-gray-100 shadow-lg rounded-xl overflow-hidden" />

                        {/* Custom Bottom UI */}
                        <Panel position="bottom-left" className="m-6 flex gap-3">
                            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-semibold text-gray-600 shadow-sm hover:bg-gray-50 transition-all">
                                <ThumbsUp size={16} className="text-gray-400" />
                                Good content
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-semibold text-gray-600 shadow-sm hover:bg-gray-50 transition-all">
                                <ThumbsDown size={16} className="text-gray-400" />
                                Bad content
                            </button>
                        </Panel>

                        <Panel position="bottom-center" className="mb-2">
                            <p className="text-[10px] text-gray-400 font-medium">NotebookLM can be inaccurate; please double check its responses.</p>
                        </Panel>
                    </ReactFlow>
                </div>
            </div>
        </div>
    );
};

export default ArchitectureView;
