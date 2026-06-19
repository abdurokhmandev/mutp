// assets/js/animations.js — Animation System

class ScrollReveal {
    constructor() {
        this.observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('revealed');
                        this.observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
        );
    }

    observe(selector) {
        document.querySelectorAll(selector).forEach((el, i) => {
            // Apply delay cascade
            el.style.transitionDelay = `${i * 80}ms`;
            el.classList.add('reveal');
            this.observer.observe(el);
        });
    }
}

// Hero Counter - Count numbers up sequentially
function animateCounter(el, target, duration = 2000) {
    const startTime = performance.now();
    const suffix = el.dataset.suffix || el.getAttribute('data-suffix') || '+';

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing — slow down near end
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);

        // Format nicely
        if (target >= 1000) {
            el.textContent = Math.round(current / 1000) + 'K' + suffix;
        } else {
            el.textContent = current + suffix;
        }

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = target >= 1000
                ? Math.round(target / 1000) + 'K' + suffix
                : target + suffix;
        }
    }

    requestAnimationFrame(update);
}

// Dashboard Stat Counter
function animateDashboardStats() {
    document.querySelectorAll('.stat-num[data-value]').forEach(el => {
        const target = parseInt(el.dataset.value);
        if (isNaN(target)) return;
        let current = 0;
        const increment = target / 40;

        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                el.textContent = target.toLocaleString('uz-UZ');
                clearInterval(timer);
            } else {
                el.textContent = Math.floor(current).toLocaleString('uz-UZ');
            }
        }, 30);
    });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize ScrollReveal
    const sr = new ScrollReveal();
    
    // Core selectors
    sr.observe('.course-card');
    sr.observe('.cat-card');
    sr.observe('.teacher-card, .teacher-mini-card');
    sr.observe('.stat-card');
    sr.observe('.section-title');
    sr.observe('.testi-card');
    sr.observe('.testimonial-card');
    sr.observe('.faq-item');
    
    window.sr = sr;

    // 2. Initialize Hero Counter
    document.querySelectorAll('[data-count], [data-target], .counter').forEach(el => {
        const targetStr = el.dataset.target || el.dataset.count || el.getAttribute('data-count');
        const target = parseInt(targetStr);
        if (isNaN(target)) return;
        
        const observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                animateCounter(el, target);
                observer.disconnect();
            }
        }, { threshold: 0.2 });
        observer.observe(el);
    });

    // 3. Initialize Dashboard Stats
    animateDashboardStats();
});
