// player.js - Custom HTML5 Video Player logic
class EduPlayer {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.container = this.video.parentElement;
    this.options = options;
    
    this.initControls();
    this.bindEvents();
    
    // Resume from last watched if provided
    if (this.options.lastWatched) {
      const setTime = () => {
        try {
          if (this.video.duration && this.options.lastWatched >= this.video.duration) {
            this.video.currentTime = 0;
          } else {
            this.video.currentTime = this.options.lastWatched;
          }
        } catch (e) {
          console.error("Failed to set currentTime:", e);
        }
      };

      if (this.video.readyState >= 1) {
        setTime();
      } else {
        this.video.addEventListener('loadedmetadata', setTime, { once: true });
      }
    }
  }

  initControls() {
    this.controls = document.createElement('div');
    this.controls.className = 'player-controls';
    this.controls.innerHTML = `
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-filled"></div>
        </div>
      </div>
      <div class="controls-main">
        <div class="controls-left">
          <button class="ctrl-btn play-pause"><i class="ti ti-player-play-filled"></i></button>
          <div class="time-display">0:00 / 0:00</div>
        </div>
        <div class="controls-right">
          <select class="speed-select">
            <option value="0.5">0.5x</option>
            <option value="1" selected>1x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
          <button class="ctrl-btn volume-btn"><i class="ti ti-volume"></i></button>
          <button class="ctrl-btn fullscreen-btn"><i class="ti ti-maximize"></i></button>
        </div>
      </div>
    `;
    this.container.appendChild(this.controls);
    
    this.playBtn = this.controls.querySelector('.play-pause');
    this.progressContainer = this.controls.querySelector('.progress-container');
    this.progressFilled = this.controls.querySelector('.progress-filled');
    this.timeDisplay = this.controls.querySelector('.time-display');
    this.speedSelect = this.controls.querySelector('.speed-select');
    this.volumeBtn = this.controls.querySelector('.volume-btn');
    this.fullscreenBtn = this.controls.querySelector('.fullscreen-btn');
  }

  bindEvents() {
    this.playBtn.addEventListener('click', () => this.togglePlay());
    this.video.addEventListener('click', () => this.togglePlay());
    this.video.addEventListener('play', () => this.updatePlayIcon());
    this.video.addEventListener('pause', () => this.updatePlayIcon());
    this.video.addEventListener('timeupdate', () => this.handleProgress());
    this.video.addEventListener('loadedmetadata', () => this.handleProgress());
    
    let isScrubbing = false;
    this.progressContainer.addEventListener('mousedown', (e) => {
      isScrubbing = true;
      this.scrub(e);
    });
    this.progressContainer.addEventListener('mousemove', (e) => {
      if(isScrubbing) this.scrub(e);
    });
    document.addEventListener('mouseup', () => { isScrubbing = false; });
    
    this.speedSelect.addEventListener('change', (e) => {
      this.video.playbackRate = parseFloat(e.target.value);
    });
    
    this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    
    // Simulate sending progress
    this.progressInterval = setInterval(() => {
      if(!this.video.paused && this.options.onProgress) {
        this.options.onProgress(this.video.currentTime);
      }
    }, 5000);
    
    this.video.addEventListener('ended', () => {
      if(this.options.onComplete) this.options.onComplete();
    });
  }

  togglePlay() {
    if(this.video.paused) this.video.play();
    else this.video.pause();
  }

  updatePlayIcon() {
    const icon = this.playBtn.querySelector('i');
    icon.className = this.video.paused ? 'ti ti-player-play-filled' : 'ti ti-player-pause-filled';
  }

  handleProgress() {
    if(!this.video.duration) return;
    const percent = (this.video.currentTime / this.video.duration) * 100;
    this.progressFilled.style.width = `${percent}%`;
    this.timeDisplay.textContent = `${this.formatTime(this.video.currentTime)} / ${this.formatTime(this.video.duration)}`;
  }

  scrub(e) {
    const rect = this.progressContainer.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    this.video.currentTime = pos * this.video.duration;
  }

  formatTime(seconds) {
    if(isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  toggleFullscreen() {
    if(!document.fullscreenElement) {
      this.container.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen();
    }
  }

  destroy() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
    if (this.controls) {
      this.controls.remove();
    }
    try {
      this.video.pause();
    } catch (e) {}
  }
}
window.EduPlayer = EduPlayer;
