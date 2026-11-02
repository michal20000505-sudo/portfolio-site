// Gwiezdne tło: to samo niebo co na index/grafika/cennik, dla stron bez własnego #starfield.
// Wpinać w <head>: <script src="starfield.js?v=…" defer></script>
(() => {
    if (document.getElementById('starfield')) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'starfield';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none';
    document.body.prepend(canvas);

    const ctx = canvas.getContext('2d');
    let width, height, stars = [];
    const mouse = { x: undefined, y: undefined };
    const colors = ['#00ffff', '#ff00ff', '#ffff00', '#ffffff', '#ffffff'];

    class Star {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 2;
            this.density = (Math.random() * 20) + 1;
            this.color = colors[Math.floor(Math.random() * colors.length)];
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.opacity = Math.random();
            this.twinkle = Math.random() * 0.02 + 0.005;
        }
        draw() {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.opacity;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0) this.x = width;
            if (this.x > width) this.x = 0;
            if (this.y < 0) this.y = height;
            if (this.y > height) this.y = 0;
            if (mouse.x) {
                const dx = mouse.x - this.x, dy = mouse.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    const f = (150 - dist) / 150;
                    this.x -= (dx / dist) * f * this.density * 2;
                    this.y -= (dy / dist) * f * this.density * 2;
                }
            }
            this.opacity += this.twinkle;
            if (this.opacity > 1 || this.opacity < 0.2) this.twinkle = -this.twinkle;
        }
    }

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        stars = [];
        for (let i = 0; i < (width * height) / 8000; i++) stars.push(new Star());
    }
    function animate() {
        ctx.clearRect(0, 0, width, height);
        stars.forEach((s) => { s.draw(); s.update(); });
        requestAnimationFrame(animate);
    }

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 150);
    });
    if (!window.matchMedia('(pointer: coarse)').matches) {
        window.addEventListener('mousemove', (e) => { mouse.x = e.x; mouse.y = e.y; });
    }
    resize();
    animate();
})();
