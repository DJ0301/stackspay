import React, { useRef, useEffect } from 'react';
import p5 from 'p5';

const CrazyStarryBackground = () => {
  const sketchRef = useRef();

  useEffect(() => {
    const sketch = (p) => {
      let stars = [];
      let shootingStars = [];
      let nebulaClouds = [];
      let time = 0;
      let mouseInfluence = { x: 0, y: 0 };
      let canvasEl = null;

      const getDocSize = () => {
        const doc = document.documentElement;
        const body = document.body;
        const width = Math.max(doc.clientWidth, window.innerWidth || 0);
        const height = Math.max(
          doc.scrollHeight,
          body.scrollHeight,
          doc.offsetHeight,
          body.offsetHeight,
          doc.clientHeight,
          window.innerHeight || 0
        );
        return { width, height };
      };

      const regenerateStars = (w, h) => {
        stars = [];
        for (let i = 0; i < 300; i++) {
          stars.push({
            x: p.random(w),
            y: p.random(h),
            size: p.random(0.5, 4),
            brightness: p.random(60, 100),
            hue: p.random([240, 280, 320, 0]), // Blue, purple, magenta, white
            twinkleSpeed: p.random(0.02, 0.08),
            phase: p.random(p.TWO_PI),
            originalX: 0,
            originalY: 0
          });
          stars[i].originalX = stars[i].x;
          stars[i].originalY = stars[i].y;
        }
      };

      p.setup = () => {
        const { width, height } = getDocSize();
        canvasEl = p.createCanvas(width, height);
        // Ensure the canvas anchors at the top-left of the page container
        if (canvasEl && canvasEl.position) {
          canvasEl.position(0, 0);
          canvasEl.style('position', 'absolute');
          canvasEl.style('top', '0');
          canvasEl.style('left', '0');
          canvasEl.style('z-index', '-10');
          canvasEl.style('pointer-events', 'none');
        }
        p.colorMode(p.HSB, 360, 100, 100, 100);
        
        // Create initial stars
        regenerateStars(width, height);

        // Create nebula clouds
        for (let i = 0; i < 8; i++) {
          nebulaClouds.push({
            x: p.random(p.width),
            y: p.random(p.height),
            size: p.random(200, 500),
            hue: p.random([240, 280, 320]),
            alpha: p.random(5, 15),
            drift: p.random(0.001, 0.003),
            phase: p.random(p.TWO_PI)
          });
        }
      };

      p.draw = () => {
        // Ensure canvas always covers the full document height
        const { width: docW, height: docH } = getDocSize();
        if (docW !== p.width || docH !== p.height) {
          p.resizeCanvas(docW, docH, false);
          regenerateStars(docW, docH);
          if (canvasEl && canvasEl.position) {
            canvasEl.position(0, 0);
          }
        }

        // Dynamic gradient background
        for (let i = 0; i <= p.height; i++) {
          let inter = p.map(i, 0, p.height, 0, 1);
          let c1 = p.color(260, 80, 15); // Deep indigo
          let c2 = p.color(280, 90, 5);  // Deep purple
          let c3 = p.color(0, 0, 0);     // Black
          
          let c;
          if (inter < 0.5) {
            c = p.lerpColor(c1, c2, inter * 2);
          } else {
            c = p.lerpColor(c2, c3, (inter - 0.5) * 2);
          }
          
          p.stroke(c);
          p.line(0, i, p.width, i);
        }

        time += 0.01;
        
        // Update mouse influence
        mouseInfluence.x = p.lerp(mouseInfluence.x, p.mouseX, 0.05);
        mouseInfluence.y = p.lerp(mouseInfluence.y, p.mouseY, 0.05);

        // Draw animated nebula clouds
        p.noStroke();
        nebulaClouds.forEach(cloud => {
          cloud.x += p.sin(time * cloud.drift + cloud.phase) * 0.5;
          cloud.y += p.cos(time * cloud.drift * 0.7 + cloud.phase) * 0.3;
          
          // Mouse interaction
          let mouseDistance = p.dist(mouseInfluence.x, mouseInfluence.y, cloud.x, cloud.y);
          let mouseEffect = p.map(mouseDistance, 0, 200, 2, 1);
          mouseEffect = p.constrain(mouseEffect, 1, 2);
          
          for (let i = 0; i < 3; i++) {
            p.fill(cloud.hue, 60 - i * 10, 30 - i * 5, cloud.alpha / (i + 1) * mouseEffect);
            p.ellipse(
              cloud.x + p.sin(time + i) * 20,
              cloud.y + p.cos(time + i) * 15,
              cloud.size + i * 50 + p.sin(time * 2) * 30,
              cloud.size + i * 50 + p.cos(time * 2) * 30
            );
          }
        });

        // Draw crazy animated stars
        stars.forEach((star, index) => {
          // Crazy movement patterns
          let waveX = p.sin(time * star.twinkleSpeed + star.phase + index * 0.1) * 15;
          let waveY = p.cos(time * star.twinkleSpeed * 0.7 + star.phase + index * 0.15) * 10;
          let spiralX = p.sin(time * 0.5 + index) * (5 + p.sin(time) * 3);
          let spiralY = p.cos(time * 0.5 + index) * (5 + p.cos(time) * 3);
          
          star.x = star.originalX + waveX + spiralX;
          star.y = star.originalY + waveY + spiralY;
          
          // Mouse interaction
          let mouseDistance = p.dist(mouseInfluence.x, mouseInfluence.y, star.x, star.y);
          let mouseEffect = p.map(mouseDistance, 0, 150, 3, 1);
          mouseEffect = p.constrain(mouseEffect, 1, 3);
          
          // Crazy twinkling
          let twinkle = p.sin(time * star.twinkleSpeed + star.phase) * 0.5 + 0.5;
          let craziness = p.sin(time * 2 + index * 0.5) * 0.3 + 0.7;
          
          // Dynamic color shifting
          let hueShift = p.sin(time * 0.3 + index * 0.2) * 30;
          let currentHue = (star.hue + hueShift) % 360;
          
          p.noStroke();
          
          // Glow effect
          for (let i = 3; i >= 0; i--) {
            let alpha = (twinkle * star.brightness * craziness * mouseEffect) / (i + 1);
            p.fill(currentHue, 70 - i * 10, 100, alpha);
            p.ellipse(
              star.x,
              star.y,
              (star.size + i * 2) * mouseEffect * craziness,
              (star.size + i * 2) * mouseEffect * craziness
            );
          }
          
          // Core star
          p.fill(currentHue, 30, 100, twinkle * star.brightness * craziness * mouseEffect);
          p.ellipse(star.x, star.y, star.size * mouseEffect, star.size * mouseEffect);
        });

        // Create shooting stars randomly
        if (p.random() < 0.003) {
          shootingStars.push({
            x: p.random(p.width),
            y: p.random(p.height * 0.3),
            vx: p.random(3, 8),
            vy: p.random(1, 3),
            life: 100,
            hue: p.random([240, 280, 320, 0]),
            trail: []
          });
        }

        // Draw and update shooting stars
        shootingStars.forEach((star, index) => {
          star.trail.push({ x: star.x, y: star.y });
          if (star.trail.length > 15) star.trail.shift();
          
          // Draw trail
          p.noFill();
          star.trail.forEach((point, i) => {
            let alpha = p.map(i, 0, star.trail.length - 1, 0, star.life);
            p.stroke(star.hue, 70, 100, alpha);
            p.strokeWeight(p.map(i, 0, star.trail.length - 1, 0.5, 3));
            if (i > 0) {
              p.line(star.trail[i-1].x, star.trail[i-1].y, point.x, point.y);
            }
          });
          
          // Draw star head
          p.noStroke();
          p.fill(star.hue, 50, 100, star.life);
          p.ellipse(star.x, star.y, 4, 4);
          
          star.x += star.vx;
          star.y += star.vy;
          star.life -= 1;
          
          if (star.life <= 0 || star.x > p.width || star.y > p.height) {
            shootingStars.splice(index, 1);
          }
        });

        // Crazy particle effects on mouse movement
        if (p.mouseIsPressed) {
          for (let i = 0; i < 5; i++) {
            p.noStroke();
            let hue = p.random([240, 280, 320]);
            p.fill(hue, 80, 100, 50);
            p.ellipse(
              p.mouseX + p.random(-20, 20),
              p.mouseY + p.random(-20, 20),
              p.random(2, 8),
              p.random(2, 8)
            );
          }
        }

        // Wrap stars around screen
        stars.forEach(star => {
          if (star.x < -10) star.originalX = p.width + 10;
          if (star.x > p.width + 10) star.originalX = -10;
          if (star.y < -10) star.originalY = p.height + 10;
          if (star.y > p.height + 10) star.originalY = -10;
        });
      };

      p.windowResized = () => {
        const { width, height } = getDocSize();
        p.resizeCanvas(width, height, false);
        regenerateStars(width, height);
        if (canvasEl && canvasEl.position) {
          canvasEl.position(0, 0);
        }
      };
    };

    const p5Instance = new p5(sketch, sketchRef.current);

    return () => {
      p5Instance.remove();
    };
  }, []);

  return (
    <div 
      ref={sketchRef} 
      className="absolute inset-0 -z-10"
      style={{ pointerEvents: 'none' }}
    />
  );
};

export default CrazyStarryBackground;
