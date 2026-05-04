import React, { useState, createContext, useContext } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import NodeDetailDrawer from '../shared/NodeDetailDrawer';

const DashboardContext = createContext({});

export function useDashboard() {
  return useContext(DashboardContext);
}

export default function DashboardLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const viewMode = 'combined';
  const showGlobalNodeDrawer = location.pathname !== '/plant' && !!selectedNodeId;

  const selectNode = (nodeId) => {
    setSelectedNodeId(nodeId);
  };

  const contextValue = {
    viewMode,
    searchQuery: '',
    selectedNodeId,
    selectNode,
  };

  return (
    <DashboardContext.Provider value={contextValue}>
      <div className="min-h-screen bg-background">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setMobileOpen(false)} />
        )}

        {/* Sidebar - hidden on mobile unless toggled */}
        <div className={`hidden lg:block`}>
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        </div>
        {mobileOpen && (
          <div className="lg:hidden fixed z-40">
            <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
          </div>
        )}

        {/* Main content */}
        <div className={`transition-all duration-300 ${collapsed ? 'lg:ml-16' : 'lg:ml-60'}`}>
          <Header
            onRefresh={() => window.location.reload()}
            onMobileMenuToggle={() => setMobileOpen(!mobileOpen)}
          />
          <main className="p-4 lg:p-6">
            <Outlet />
          </main>
        </div>

        {/* Node detail drawer */}
        <NodeDetailDrawer
          nodeId={selectedNodeId}
          open={showGlobalNodeDrawer}
          onClose={() => setSelectedNodeId(null)}
          viewMode={viewMode}
        />
      </div>
    </DashboardContext.Provider>
  );
}
