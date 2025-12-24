import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    Panel,
    Edge,
    Position,
    Handle,
    NodeProps,
    useReactFlow,
    ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Maximize2, Download, ThumbsUp, ThumbsDown, ChevronLeft, ChevronRight, Loader2, RefreshCw, ZoomIn, ZoomOut, Crosshair, Expand, Minimize } from "lucide-react";

// RAG API Configuration
const RAG_API_URL = process.env.NEXT_PUBLIC_RAG_API_URL || "http://localhost:8002";

// Types for knowledge graph
interface GraphNode {
    id: string;
    label: string;
    type: string;
    color: string;
    level: number;
    metadata?: Record<string, unknown>;
}

interface GraphEdge {
    id: string;
    source: string;
    target: string;
}

interface GraphStatistics {
    tree_size: number;
    tree_height: number;
    total_edges: number;
    leaf_nodes: number;
    parent_nodes: number;
    child_nodes: number;
    nodes_by_level: Record<number, number>;
    level_names: Record<number, string>;
}

interface KnowledgeGraphData {
    success: boolean;
    nodes: GraphNode[];
    edges: GraphEdge[];
    metadata?: Record<string, unknown>;
    statistics?: GraphStatistics;
    error?: string;
}

// --- Custom Node Component ---
const MindMapNode = ({ data }: NodeProps) => {
    const { label, color, isExpanded, hasChildren, onToggle, direction, onClick, nodeType } = data as any;

    const handleClick = (e: React.MouseEvent) => {
        if (onClick) {
            e.stopPropagation();
            onClick();
        }
    };

    return (
        <div className="relative group" onClick={handleClick}>
            {hasChildren && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle?.();
                    }}
                    className={`absolute ${direction === "left" ? "-left-6" : "-right-6"} top-1/2 -translate-y-1/2 w-5 h-5 bg-white border border-gray-200 rounded-full flex items-center justify-center text-blue-500 hover:bg-blue-50 transition-colors z-[100] shadow-sm cursor-pointer`}
                >
                    {isExpanded ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
                </button>
            )}

            <div
                className={`${color} px-4 py-2 rounded-xl shadow-md border border-black/5 min-w-[120px] max-w-[180px] flex items-center justify-center text-sm font-semibold text-gray-800 transition-all hover:scale-105 hover:shadow-lg cursor-pointer`}
                title={label}
            >
                <span className="truncate">{label}</span>
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
    onNodeClick?: (nodeId: string, nodeData: any) => void;
    graphData?: KnowledgeGraphData | null;
}

const ArchitectureView: React.FC<ArchitectureViewProps> = ({
    onClose,
    onExpand,
    isModal = true,
    onNodeClick,
    graphData: externalGraphData,
}) => {
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
    const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(externalGraphData || null);
    const [isLoading, setIsLoading] = useState(!externalGraphData);
    const [error, setError] = useState<string | null>(null);

    // Fetch knowledge graph data from API
    const fetchKnowledgeGraph = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${RAG_API_URL}/api/rag/knowledge-graph`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ max_nodes: 25 }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch knowledge graph');
            }

            const data: KnowledgeGraphData = await response.json();

            if (data.success && data.nodes.length > 0) {
                setGraphData(data);
                // Auto-expand root node
                setExpandedNodes(new Set(['root']));
            } else {
                setError(data.error || 'No data available');
            }
        } catch (err) {
            console.error('Error fetching knowledge graph:', err);
            setError('Failed to load knowledge graph');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Fetch data on mount if not provided externally
    useEffect(() => {
        if (!externalGraphData) {
            fetchKnowledgeGraph();
        }
    }, [externalGraphData, fetchKnowledgeGraph]);

    // Update when external data changes
    useEffect(() => {
        if (externalGraphData) {
            setGraphData(externalGraphData);
            setIsLoading(false);
        }
    }, [externalGraphData]);

    const toggleExpand = useCallback((nodeId: string) => {
        setExpandedNodes((prev) => {
            const next = new Set(prev);
            if (next.has(nodeId)) {
                next.delete(nodeId);
            } else {
                next.add(nodeId);
            }
            return next;
        });
    }, []);

    // Expand all nodes
    const expandAll = useCallback(() => {
        if (graphData) {
            const allNodeIds = new Set(graphData.nodes.map(n => n.id));
            setExpandedNodes(allNodeIds);
        }
    }, [graphData]);

    // Collapse all nodes (keep only root)
    const collapseAll = useCallback(() => {
        setExpandedNodes(new Set(['root']));
    }, []);

    const handleNodeClick = useCallback((nodeId: string, nodeData: any) => {
        if (onNodeClick) {
            // Include the root label (document context) in the node data
            const rootNode = graphData?.nodes.find(n => n.id === 'root');
            const enrichedNodeData = {
                ...nodeData,
                rootLabel: rootNode?.label || 'the knowledge base',
            };
            onNodeClick(nodeId, enrichedNodeData);
        }
    }, [onNodeClick, graphData]);

    // Convert API graph data to React Flow format
    const { flowNodes, flowEdges } = useMemo(() => {
        if (!graphData || !graphData.nodes.length) {
            return { flowNodes: [], flowEdges: [] };
        }

        const nodes: any[] = [];
        const edges: Edge[] = [];

        // Group nodes by level for positioning
        const nodesByLevel: Record<number, GraphNode[]> = {};
        graphData.nodes.forEach(node => {
            const level = node.level || 0;
            if (!nodesByLevel[level]) {
                nodesByLevel[level] = [];
            }
            nodesByLevel[level].push(node);
        });

        // Calculate positions based on level
        const xSpacing = 220;
        const ySpacing = 80;

        Object.entries(nodesByLevel).forEach(([levelStr, levelNodes]) => {
            const level = parseInt(levelStr);
            const totalHeight = (levelNodes.length - 1) * ySpacing;
            const startY = -totalHeight / 2;

            levelNodes.forEach((node, index) => {
                const x = level * xSpacing;
                const y = startY + index * ySpacing;

                // Determine if node has children
                const hasChildren = graphData.edges.some(e => e.source === node.id);
                const isExpanded = expandedNodes.has(node.id);

                // Only show nodes that are connected to expanded parents (or root)
                let shouldShow = level === 0; // Always show root
                if (level > 0) {
                    // Check if parent is expanded
                    const parentEdge = graphData.edges.find(e => e.target === node.id);
                    if (parentEdge) {
                        const parentNode = graphData.nodes.find(n => n.id === parentEdge.source);
                        if (parentNode) {
                            // Show if parent is expanded or if parent is root and root is expanded
                            shouldShow = expandedNodes.has(parentEdge.source);
                        }
                    }
                }

                if (shouldShow) {
                    nodes.push({
                        id: node.id,
                        type: 'mindmap',
                        position: { x, y },
                        data: {
                            label: node.label,
                            color: node.color || 'bg-[#bfdbfe]',
                            hasChildren,
                            isExpanded,
                            onToggle: hasChildren ? () => toggleExpand(node.id) : undefined,
                            direction: 'right',
                            nodeType: node.type,
                            onClick: () => handleNodeClick(node.id, node),
                        },
                    });
                }
            });
        });

        // Create edges only for visible nodes
        const visibleNodeIds = new Set(nodes.map(n => n.id));
        graphData.edges.forEach(edge => {
            if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
                edges.push({
                    id: edge.id,
                    source: edge.source,
                    target: edge.target,
                    animated: false,
                    style: { stroke: '#cbd5e1', strokeWidth: 2 },
                    type: 'smoothstep',
                });
            }
        });

        return { flowNodes: nodes, flowEdges: edges };
    }, [graphData, expandedNodes, toggleExpand, handleNodeClick]);

    // Get title from graph data
    const title = useMemo(() => {
        if (!graphData || !graphData.nodes.length) {
            return 'Knowledge Graph';
        }
        const rootNode = graphData.nodes.find(n => n.id === 'root');
        return rootNode?.label || 'Knowledge Graph';
    }, [graphData]);

    const sourceCount = (graphData?.metadata?.total_documents as number) || graphData?.nodes.filter(n => n.type === 'document').length || 1;

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
                                <span className="text-gray-900">Mindmap</span>
                            </div>
                        )}
                        <h2 className={`${isModal ? 'text-xl' : 'text-sm'} font-semibold text-gray-800 tracking-tight truncate max-w-[300px] lg:max-w-none`}>
                            {isLoading ? 'Loading...' : title}
                        </h2>
                        <div className="flex items-center gap-3 text-[10px] text-gray-400 font-medium">
                            <span>Based on {sourceCount} source{sourceCount !== 1 ? 's' : ''}</span>
                            {graphData?.statistics && (
                                <>
                                    <span className="text-gray-300">•</span>
                                    <span className="text-purple-500">{graphData.statistics.tree_size} nodes</span>
                                    <span className="text-gray-300">•</span>
                                    <span className="text-blue-500">{graphData.statistics.total_edges} edges</span>
                                    <span className="text-gray-300">•</span>
                                    <span className="text-green-500">{graphData.statistics.tree_height} levels</span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={fetchKnowledgeGraph}
                            disabled={isLoading}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Refresh"
                        >
                            <RefreshCw size={isModal ? 18 : 16} className={isLoading ? 'animate-spin' : ''} />
                        </button>
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
                    {isLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                                <p className="text-sm text-gray-500">Generating knowledge graph...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3 text-center px-4">
                                <p className="text-sm text-gray-500">{error}</p>
                                <button
                                    onClick={fetchKnowledgeGraph}
                                    className="px-4 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors"
                                >
                                    Try Again
                                </button>
                            </div>
                        </div>
                    ) : flowNodes.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3 text-center px-4">
                                <p className="text-sm text-gray-500">No documents indexed yet</p>
                                <p className="text-xs text-gray-400">Upload documents to generate a knowledge graph</p>
                            </div>
                        </div>
                    ) : (
                        <ReactFlow
                            nodes={flowNodes}
                            edges={flowEdges}
                            nodeTypes={nodeTypes}
                            fitView
                            fitViewOptions={{ padding: 0.3 }}
                            minZoom={0.1}
                            maxZoom={3}
                            className="cursor-grab active:cursor-grabbing"
                            colorMode="light"
                            proOptions={{ hideAttribution: true }}
                        >
                            <Background color="#f1f5f9" gap={20} />
                            <Controls
                                showInteractive={false}
                                className="bg-white border-gray-100 shadow-lg rounded-xl overflow-hidden"
                                position="bottom-right"
                            />
                            <MiniMap
                                className="bg-white/80 border border-gray-100 rounded-xl shadow-lg"
                                nodeColor={(node) => {
                                    const color = (node.data as { color?: string })?.color;
                                    if (!color) return '#bfdbfe';
                                    // Map Tailwind bg classes to hex colors
                                    const colorMap: Record<string, string> = {
                                        'bg-[#bfdbfe]': '#bfdbfe',
                                        'bg-[#fef3c7]': '#fef3c7',
                                        'bg-[#d1fae5]': '#d1fae5',
                                        'bg-[#e9d5ff]': '#e9d5ff',
                                        'bg-[#fecaca]': '#fecaca',
                                    };
                                    return colorMap[color] || '#bfdbfe';
                                }}
                                maskColor="rgba(0, 0, 0, 0.1)"
                                position="bottom-right"
                                style={{ marginBottom: 60 }}
                            />

                            {/* Expand/Collapse Controls */}
                            <Panel position="top-left" className="m-4">
                                <div className="bg-white/90 backdrop-blur-sm border border-gray-100 rounded-xl p-2 shadow-lg flex gap-2">
                                    <button
                                        onClick={expandAll}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                        title="Expand all nodes"
                                    >
                                        <Expand size={14} />
                                        Expand All
                                    </button>
                                    <button
                                        onClick={collapseAll}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                        title="Collapse all nodes"
                                    >
                                        <Minimize size={14} />
                                        Collapse
                                    </button>
                                </div>
                            </Panel>

                            {/* Statistics Panel */}
                            {graphData?.statistics && (
                                <Panel position="top-right" className="m-4">
                                    <div className="bg-white/90 backdrop-blur-sm border border-gray-100 rounded-xl p-3 shadow-lg max-w-[200px]">
                                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Graph Stats</h4>
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                                            <span className="text-gray-500">Tree Size:</span>
                                            <span className="font-semibold text-gray-700">{graphData.statistics.tree_size}</span>
                                            <span className="text-gray-500">Tree Height:</span>
                                            <span className="font-semibold text-gray-700">{graphData.statistics.tree_height}</span>
                                            <span className="text-gray-500">Edges:</span>
                                            <span className="font-semibold text-gray-700">{graphData.statistics.total_edges}</span>
                                            <span className="text-gray-500">Leaf Nodes:</span>
                                            <span className="font-semibold text-green-600">{graphData.statistics.leaf_nodes}</span>
                                            <span className="text-gray-500">Parent Nodes:</span>
                                            <span className="font-semibold text-blue-600">{graphData.statistics.parent_nodes}</span>
                                        </div>
                                        {graphData.statistics.nodes_by_level && (
                                            <div className="mt-2 pt-2 border-t border-gray-100">
                                                <h5 className="text-[9px] font-bold text-gray-400 uppercase mb-1">By Level</h5>
                                                <div className="flex flex-wrap gap-1">
                                                    {Object.entries(graphData.statistics.nodes_by_level).map(([level, count]) => (
                                                        <span key={level} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                                            L{level}: {count}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Panel>
                            )}

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
                                <p className="text-[10px] text-gray-400 font-medium">Click nodes to ask about them • Drag to pan • Scroll to zoom • Use controls to navigate</p>
                            </Panel>
                        </ReactFlow>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ArchitectureView;
