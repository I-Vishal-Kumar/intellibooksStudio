/**
 * Service Ports Configuration
 * 
 * Ports are defined in ports.json and exported here for TypeScript usage.
 * For Python services, use the ports.json file directly.
 */

// Import JSON with type assertion
import portsConfigData from '../../ports.json';

const portsConfig = portsConfigData as {
  services: Record<string, number>;
  apps: Record<string, number>;
  infrastructure: Record<string, number>;
  mcp: Record<string, number>;
};

export const SERVICE_PORTS = portsConfig.services;
export const APP_PORTS = portsConfig.apps;
export const INFRASTRUCTURE_PORTS = portsConfig.infrastructure;
export const MCP_PORTS = portsConfig.mcp;

// Individual service ports for convenience
export const AGENTS_PORT = SERVICE_PORTS.agents;
export const RAG_PORT = SERVICE_PORTS.rag;
export const RBAC_PORT = SERVICE_PORTS.rbac;
export const WEBSOCKET_PORT = SERVICE_PORTS.websocket;

export const UI_PORT = APP_PORTS.ui;
export const API_GATEWAY_PORT = APP_PORTS['api-gateway'];

export default portsConfig;

