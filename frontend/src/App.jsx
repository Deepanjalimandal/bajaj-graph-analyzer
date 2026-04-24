import React, { useState, useCallback, useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MarkerType 
} from 'reactflow';
import 'reactflow/dist/style.css';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Network, 
  AlertCircle, 
  AlertTriangle, 
  Play, 
  RotateCcw, 
  Clock, 
  Crown, 
  Trees as TreeIcon, 
  Binary, 
  Fingerprint, 
  Activity 
} from 'lucide-react';
import FractalTree from './FractalTree';

const API_URL = 'http://localhost:3000/bfhl';

/**
 * Graph Relationship Analyzer - Main Application
 * 
 * This application allows users to visualize complex relationship networks,
 * detect tree structures, and identify circular anomalies.
 */

function App() {
  // --- State Management ---
  const [inputValue, setInputValue] = useState('A->B, A->C, B->D, E->F, F->E, X->X');
  const [apiResponse, setApiResponse] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState(null);
  const [serverSideTime, setServerSideTime] = useState(0);

  // --- Handlers ---

  /**
   * Submits the relationship data to our backend for processing.
   */
  const handleAnalysis = async () => {
    setIsProcessing(true);
    setProcessingError(null);
    const startTimestamp = performance.now();
    
    try {
      // Clean up the input: split by comma, remove whitespace, and filter empty strings
      const relationshipEdges = inputValue
        .split(',')
        .map(str => str.trim())
        .filter(Boolean);

      const response = await axios.post(API_URL, { data: relationshipEdges });
      
      setApiResponse(response.data);
      setServerSideTime(Math.round(performance.now() - startTimestamp));
    } catch (err) {
      console.error("API Error:", err);
      setProcessingError(
        err.response?.data?.message || 
        'Could not reach the analysis server. Please check your connection or ensure the backend is running on port 3000.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Pre-fills the input with a complex scenario for demonstration.
   */
  const loadComplexExample = () => {
    setInputValue('A->B, A->C, B->D, B->E, E->F, G->H, H->G, X->X, invalid_data');
  };

  /**
   * Transforms the API hierarchy data into React Flow nodes and edges.
   * We use useMemo to avoid re-calculating this on every minor UI tender.
   */
  const { flowNodes, flowEdges } = useMemo(() => {
    if (!apiResponse || !apiResponse.hierarchies) return { flowNodes: [], flowEdges: [] };

    const nodes = [];
    const edges = [];
    let initialXOffset = 0;

    // Process each hierarchy group (can be a tree or a cycle)
    apiResponse.hierarchies.forEach((group, groupIndex) => {
      const { root, tree, has_cycle } = group;
      const isTopLevelLeader = root === apiResponse.summary.largest_tree_root;
      
      /**
       * Recursively traverses a tree structure to map out node positions.
       */
      const buildTreeNodes = (name, children, x, y, parentNodeId = null) => {
        const nodeId = `node-${groupIndex}-${name}`;
        
        // Visual logic for highlighting
        let nodeStyling = '';
        if (has_cycle) nodeStyling = 'cycle-red';
        else if (isTopLevelLeader && parentNodeId === null) nodeStyling = 'root-gold';

        nodes.push({
          id: nodeId,
          data: { label: name },
          position: { x, y },
          className: nodeStyling
        });

        // If this node has a parent, draw the connecting edge
        if (parentNodeId) {
          edges.push({
            id: `edge-${parentNodeId}-${nodeId}`,
            source: parentNodeId,
            target: nodeId,
            animated: has_cycle, // Animate cycle edges for better visibility
            className: has_cycle ? 'cycle-edge' : '',
            markerEnd: { 
              type: MarkerType.ArrowClosed, 
              color: has_cycle ? '#ef4444' : '#64748b' 
            }
          });
        }

        // Layout children horizontally
        const childrenKeys = Object.keys(children);
        childrenKeys.forEach((childName, i) => {
          const shiftX = x + (i - (childrenKeys.length - 1) / 2) * 160;
          buildTreeNodes(childName, children[childName], shiftX, y + 120, nodeId);
        });
      };

      if (has_cycle) {
        // Cycles are handled as a single specialized anomaly group node for simplicity
        nodes.push({
          id: `anomaly-group-${groupIndex}`,
          data: { label: `${root} (Anomaly Group)` },
          position: { x: initialXOffset, y: 0 },
          className: 'cycle-red'
        });
      } else {
        buildTreeNodes(root, tree, initialXOffset, 0);
      }

      initialXOffset += 450; // Provide generous space between disjoint hierarchies
    });

    return { flowNodes: nodes, flowEdges: edges };
  }, [apiResponse]);

  // --- Rendering ---

  return (
    <div className="app-container" style={{ position: 'relative', overflowX: 'hidden' }}>
      {/* Decorative background animation */}
      <FractalTree />
      
      <header style={{ position: 'relative', zIndex: 10 }}>
        <motion.h1 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          Graph Relationship Analyzer
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="subtitle"
        >
          Detect structures and anomalies in relationship networks
        </motion.p>
      </header>

      {/* Input Section */}
      <section className="card input-section">
        <h2 className="section-heading"><Activity size={20} color="#38bdf8" /> Network Ingestion</h2>
        <textarea 
          placeholder="Enter relationships (e.g. A->B, B->C)"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <div className="actions">
          <div className="btn-group">
            <button className="btn-primary" onClick={handleAnalysis} disabled={isProcessing}>
              <Play size={18} fill="currentColor" /> {isProcessing ? 'Analyzing...' : 'Analyze Network'}
            </button>
            <button className="btn-secondary" onClick={loadComplexExample}>
              <RotateCcw size={18} /> Load Example
            </button>
          </div>
          
          <AnimatePresence>
            {apiResponse && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="processing-info"
              >
                <div className="info-item">
                  <Binary size={16} /> {inputValue.split(',').filter(Boolean).length} Relationships
                </div>
                <div className="info-item">
                  <Clock size={16} /> {serverSideTime}ms Processing
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Error Feedback */}
      <AnimatePresence>
        {processingError && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="panel panel-error"
          >
            <h3><AlertCircle size={18} /> Connection Lost or Logic Error</h3>
            <p>{processingError}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results Workspace */}
      <AnimatePresence>
        {apiResponse && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{ display: 'flex', flexDirection: 'column', gap: '3.5rem' }}
          >
            {/* Top-level Statistics */}
            <div className="summary-grid">
              <SummaryCard 
                label="Healthy Hierarchies" 
                value={apiResponse.summary.total_trees} 
                icon={<TreeIcon size={24} color="#10b981" />}
                type="trees"
              />
              <SummaryCard 
                label="Detected Anomalies" 
                value={apiResponse.summary.total_cycles} 
                icon={<AlertTriangle size={24} color="#ef4444" />}
                type="cycles"
              />
              <SummaryCard 
                label="Primary Network Root" 
                value={apiResponse.summary.largest_tree_root} 
                icon={<Crown size={24} color="#f59e0b" />}
                type="largest"
              />
            </div>

            {/* Interactive Graph Canvas */}
            <div className="visualization-wrapper">
              <div className="graph-label valid"><Fingerprint size={14} /> Valid Relationship Network</div>
              <div className="graph-label anomaly"><AlertTriangle size={14} /> Anomaly Detected (Circular Relationship)</div>
              
              <div className="visualization-container">
                <ReactFlow
                  nodes={flowNodes}
                  edges={flowEdges}
                  fitView
                  nodesDraggable={true}
                  nodesConnectable={false}
                >
                  <Background color="#1e293b" gap={24} size={1} />
                  <Controls />
                </ReactFlow>
              </div>
            </div>

            {/* Sanitization Logs */}
            <div className="panel-grid">
              <div className="panel panel-error">
                <h3><AlertCircle size={18} color="#ef4444" /> Data Sanitization Log</h3>
                <div className="badge-container">
                  {apiResponse.invalid_entries.length > 0 ? (
                    apiResponse.invalid_entries.map((entry, i) => (
                      <span key={i} className="badge badge-error">{entry}</span>
                    ))
                  ) : (
                    <span style={{ color: '#64748b', fontSize: '0.9rem' }}>All data entries were valid.</span>
                  )}
                </div>
              </div>
              <div className="panel panel-warning">
                <h3><RotateCcw size={18} color="#f59e0b" /> Redundancy Filter</h3>
                <div className="badge-container">
                  {apiResponse.duplicate_edges.length > 0 ? (
                    apiResponse.duplicate_edges.map((entry, i) => (
                      <span key={i} className="badge badge-warning">{entry}</span>
                    ))
                  ) : (
                    <span style={{ color: '#64748b', fontSize: '0.9rem' }}>No duplicate edges were detected.</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Loader */}
      {isProcessing && (
        <div className="loading">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, type }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className={`card summary-card ${type}`}
    >
      <div className="summary-icon">{icon}</div>
      <div>
        <div className="summary-label">{label}</div>
        <div className="summary-value">{value}</div>
      </div>
    </motion.div>
  );
}

export default App;
