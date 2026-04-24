const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

const USER_ID = "deep_24042026";
const EMAIL_ID = "dm8357@srmist.edu.in";
const ROLL_NUMBER = "RA2311008020112";

// ==========================================
// API Handlers
// ==========================================

// GET /bfhl: A simple health check to verify the service is alive.
app.get('/bfhl', (req, res) => {
    console.log("Health check: Service is operational.");
    res.status(200).json({ operation_code: 1 });
});

// POST /bfhl: The main processing engine for relationship data.
app.post('/bfhl', (req, res) => {
    const { data } = req.body;
    console.log(`Processing request with ${data?.length || 0} items...`);
    
    // Basic structural validation
    if (!data || !Array.isArray(data)) {
        console.error("Invalid input detected: 'data' is missing or not an array.");
        return res.status(400).json({ is_success: false, message: "Expected a JSON object with a 'data' array of strings." });
    }

    // Core data structures for our graph analyzer
    const adjacencyList = new Map();     // To track parent -> children relationships
    const inDegrees = new Map();         // To identify root nodes (in-degree 0)
    const parentMap = new Map();         // To enforce the "single-parent" rule for trees
    const uniqueNodes = new Set();       // To keep track of every distinct letter/person seen
    const invalid_entries = [];          // For entries that don't fit our X->Y format
    const duplicate_edges = [];          // For edges we've already processed
    const uniqueDuplicates = new Set();  // To avoid reporting the same duplicate twice
    const processedEdges = new Set();    // Internal registry for unique edges

    const relationshipPattern = /^[A-Z]->[A-Z]$/;

    // Phase 1: Ingestion & Validation
    data.forEach(entry => {
        const rawString = entry.toString();
        const relationship = rawString.trim();
        
        // 1. Format check (e.g., A->B)
        if (!relationshipPattern.test(relationship)) {
            console.warn(`Filtering invalid format: "${rawString}"`);
            invalid_entries.push(rawString);
            return;
        }

        const [parent, child] = relationship.split('->');

        // 2. Self-loop check (A->A)
        if (parent === child) {
            console.warn(`Filtering self-loop: "${rawString}"`);
            invalid_entries.push(rawString);
            return;
        }

        uniqueNodes.add(parent);
        uniqueNodes.add(child);

        // 3. Duplicate check
        if (processedEdges.has(relationship)) {
            if (!uniqueDuplicates.has(relationship)) {
                duplicate_edges.push(relationship);
                uniqueDuplicates.add(relationship);
            }
            return;
        }

        processedEdges.add(relationship);

        // 4. Structural Rule: Multi-parent check
        // If a child already has a "home" (parent), we ignore subsequent incoming edges
        // to maintain a clean tree/forest hierarchy.
        if (!parentMap.has(child)) {
            parentMap.set(child, parent);
            
            if (!adjacencyList.has(parent)) adjacencyList.set(parent, new Set());
            adjacencyList.get(parent).add(child);
            
            inDegrees.set(child, (inDegrees.get(child) || 0) + 1);
            if (!inDegrees.has(parent)) inDegrees.set(parent, 0);
        }
    });

    // Ensure all registered nodes have an entry in our in-degree tracker
    uniqueNodes.forEach(node => {
        if (!inDegrees.has(node)) inDegrees.set(node, 0);
    });

    // Find our "pioneers" - nodes with nobody pointing to them
    const potentialRoots = Array.from(uniqueNodes).filter(node => inDegrees.get(node) === 0).sort();
    const globalVisitedRegistry = new Set();
    const hierarchies = [];

    // Phase 2: Building Hierarchies (Depth-First Traversal)
    const activePathStack = new Set(); // To prevent circular logic within our tree builder
    
    function buildTreeRecursively(node, depth) {
        globalVisitedRegistry.add(node);
        activePathStack.add(node);
        
        let pathDepthLimit = depth;
        const children = (adjacencyList.get(node) || new Set());
        const treeSubstructure = {};
        
        // Sort children lexicographically for consistent output
        const sortedChildren = Array.from(children).sort();
        
        sortedChildren.forEach(child => {
            if (activePathStack.has(child)) return; // Safety break
            
            const { tree: subTree, maxDepth: subMaxDepth } = buildTreeRecursively(child, depth + 1);
            treeSubstructure[child] = subTree;
            pathDepthLimit = Math.max(pathDepthLimit, subMaxDepth);
        });

        activePathStack.delete(node);
        return { tree: treeSubstructure, maxDepth: pathDepthLimit };
    }

    // Process every root node to extract its respective tree
    potentialRoots.forEach(root => {
        const { tree, maxDepth } = buildTreeRecursively(root, 1);
        hierarchies.push({
            root,
            tree,
            max_depth: maxDepth,
            has_cycle: false
        });
    });

    // Phase 3: Anomaly Detection (Cycle Handling)
    // Any node not picked up by the tree processing must be part of an isolated cycle.
    const unvisitedNodeQueue = Array.from(uniqueNodes).filter(node => !globalVisitedRegistry.has(node)).sort();
    let cycleCount = 0;
    
    while (unvisitedNodeQueue.length > 0) {
        const startingNode = unvisitedNodeQueue[0];
        
        // Explore the connected component using BFS
        const BFSQueue = [startingNode];
        const componentNodes = [];
        const localExploredSet = new Set();
        localExploredSet.add(startingNode);
        
        while(BFSQueue.length > 0) {
            const node = BFSQueue.shift();
            componentNodes.push(node);
            
            // Neighbors are both children and parents (from valid processed edges)
            const children = adjacencyList.get(node) || new Set();
            const parent = parentMap.get(node);
            
            children.forEach(child => {
                if (!localExploredSet.has(child)) {
                    localExploredSet.add(child);
                    BFSQueue.push(child);
                }
            });
            
            if (parent && !localExploredSet.has(parent)) {
                localExploredSet.add(parent);
                BFSQueue.push(parent);
            }
        }

        // Commit these nodes to the global registry
        componentNodes.forEach(node => globalVisitedRegistry.add(node));

        // Group the cycle under its lexicographical leader
        const groupLeader = componentNodes.sort()[0];
        
        hierarchies.push({
            root: groupLeader,
            tree: {},
            max_depth: 0,
            has_cycle: true
        });
        
        cycleCount++;
        
        // Update the queue of unvisited nodes
        const remaining = Array.from(uniqueNodes).filter(node => !globalVisitedRegistry.has(node)).sort();
        unvisitedNodeQueue.length = 0;
        unvisitedNodeQueue.push(...remaining);
    }

    // Sort the final results so the client receives a predictable order
    hierarchies.sort((a, b) => a.root.localeCompare(b.root));

    // Phase 4: Summarization
    const validTreeCount = hierarchies.filter(h => !h.has_cycle).length;
    let strongestRoot = "None";
    let deepestPathFound = -1;

    hierarchies.forEach(h => {
        if (!h.has_cycle) {
            if (h.max_depth > deepestPathFound) {
                deepestPathFound = h.max_depth;
                strongestRoot = h.root;
            } else if (h.max_depth === deepestPathFound) {
                if (h.root < strongestRoot) strongestRoot = h.root;
            }
        }
    });

    console.log(`Processing complete. Statistics: Trees: ${validTreeCount}, Cycles: ${cycleCount}`);

    // Exact output structure as requested in the challenge
    res.status(200).json({
        user_id: USER_ID,
        email_id: EMAIL_ID,
        college_roll_number: ROLL_NUMBER,
        hierarchies,
        invalid_entries,
        duplicate_edges,
        summary: {
            total_trees: validTreeCount,
            total_cycles: cycleCount,
            largest_tree_root: strongestRoot
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
