// Custom Lightweight Donut/Pie Chart Class
export default class PieChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.data = [];
    this.colors = [
      '#ef4444', // Core (Red)
      '#f59e0b', // Browser (Orange/Yellow)
      '#6366f1', // IDE & Dev (Indigo)
      '#10b981', // Cloud Storage (Green)
      '#8b5cf6', // Other Apps (Violet)
      '#06b6d4', // Cached (Cyan)
      '#8a92b2'  // Free (Muted Blue)
    ];
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

  updateData(newData) {
    this.data = newData;
    this.draw();
  }

  draw() {
    if (!this.ctx || !this.canvas || !this.data || this.data.length === 0) return;
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    
    ctx.clearRect(0, 0, w, h);
    
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 5;
    
    const total = this.data.reduce((sum, d) => sum + d.val, 0);
    if (total === 0) return;
    
    let startAngle = -Math.PI / 2; // Start at 12 o'clock
    
    this.data.forEach((slice, idx) => {
      const sliceAngle = (slice.val / total) * 2 * Math.PI;
      
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      
      ctx.fillStyle = this.colors[idx % this.colors.length];
      ctx.fill();
      
      // Separator stroke
      ctx.strokeStyle = '#161825'; // matches card background
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      startAngle += sliceAngle;
    });

    // Donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.55, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#161825'; // matches background
    ctx.fill();
  }
}
