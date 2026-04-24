import React, { useEffect, useRef } from 'react';

/**
 * FractalTree Background Component
 * 
 * Generates an animated recursive tree on a canvas.
 * Features a growth initiation phase followed by a subtle wind-sway effect.
 */
const FractalTree = () => {
    const canvasRef = useRef(null);
    const animationFrameRef = useRef();

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        // Initial dimensions
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = 400);

        // Animation State
        let growthState = 0; // 0 to 1 (full growth)
        let windTime = 0;    // Continuous time for the sway sine wave

        /**
         * The Recursive Engine
         * @param {number} x - Starting X coordinate
         * @param {number} y - Starting Y coordinate
         * @param {number} len - Length of current branch
         * @param {number} angle - Orientation in degrees
         * @param {number} branchWidth - Thickness of the current segment
         */
        const drawBranch = (x, y, len, angle, branchWidth) => {
            ctx.beginPath();
            ctx.save();
            
            // Premium look: Cyan stroke with a soft cyan glow
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 + growthState * 0.2})`;
            ctx.shadowBlur = 12;
            ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
            ctx.lineWidth = branchWidth;
            
            // Move coordinate system to the branch start
            ctx.translate(x, y);
            ctx.rotate((angle * Math.PI) / 180);
            
            // Draw the line from bottom up
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -len * growthState);
            ctx.stroke();

            // Termination condition: Stop when branches get too small
            if (len < 12) {
                ctx.restore();
                return;
            }

            // Spawn left and right children with variation and wind sway
            // We use Math.sin/cos tied to windTime to create an organic harmonic motion
            const branchShrink = 0.75;
            const leftAngle = angle + 25 + Math.sin(windTime) * 6;
            const rightAngle = angle - 25 + Math.cos(windTime) * 6;

            drawBranch(0, -len * growthState, len * branchShrink, leftAngle, branchWidth * 0.7);
            drawBranch(0, -len * growthState, len * branchShrink, rightAngle, branchWidth * 0.7);

            ctx.restore();
        };

        const renderFrame = () => {
            // Clear but keep it high-performance
            ctx.clearRect(0, 0, width, height);
            
            // Update growth
            if (growthState < 1) growthState += 0.005;
            
            // Update wind time
            windTime += 0.02;

            // Draw the main trunk in the center bottom
            drawBranch(width / 2, height, 85, 0, 4);

            animationFrameRef.current = requestAnimationFrame(renderFrame);
        };

        renderFrame();

        // Responsive handling
        const handleResize = () => {
            width = canvas.width = window.innerWidth;
        };

        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationFrameRef.current);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // Styling to keep the canvas strictly as a background element
    const backgroundStyles = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '400px',
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 0.5,
        maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
    };

    return <canvas ref={canvasRef} style={backgroundStyles} />;
};

export default FractalTree;
