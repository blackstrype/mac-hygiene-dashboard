// Custom Lightweight Canvas Line Chart Class
export default class MiniChart {
  constructor(canvasId, maxPoints = 30, color = '#6366f1', type = 'percent') {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.maxPoints = maxPoints;
    this.color = color;
    this.type = type; // 'percent', 'ram', 'swap'
    this.data = Array(maxPoints).fill(0);
    this.totalRamGB = 16.0; // default, updated dynamically
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * window.devicePixelRatio;
    this.canvas.height = rect.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.draw();
  }

  addData(val) {
    this.data.push(val);
    if (this.data.length > this.maxPoints) {
      this.data.shift();
    }
    this.draw();
  }

  draw() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    // Subtle horizontal gridlines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let y = h / 4; y < h; y += h / 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const maxVal = Math.max(...this.data, 10);
    const points = this.data.map((val, idx) => {
      const x = (idx / (this.maxPoints - 1)) * w;
      // Leave small margin top/bottom
      const y = h - (val / maxVal) * (h - 10) - 5;
      return { x, y };
    });

    // Draw gradient area
    ctx.beginPath();
    ctx.moveTo(0, h);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(w, h);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, this.color + '33'); // 20% opacity
    grad.addColorStop(1, this.color + '00'); // 0% opacity
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw Y-axis watermark labels on the right
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    
    let topLabel = '';
    let bottomLabel = '0';
    
    if (this.type === 'percent') {
      topLabel = '100%';
      bottomLabel = '0%';
    } else if (this.type === 'ram') {
      topLabel = `${this.totalRamGB.toFixed(0)} GB`;
      bottomLabel = '0 GB';
    } else if (this.type === 'swap') {
      topLabel = `${maxVal.toFixed(1)} GB`;
      bottomLabel = '0 GB';
    }
    
    ctx.fillText(topLabel, w - 8, 12);
    ctx.fillText(bottomLabel, w - 8, h - 6);
  }
}
