document.addEventListener('DOMContentLoaded', () => {
  const hwId = new URLSearchParams(window.location.search).get('id');
  if (!hwId) {
    window.location.href = '/';
    return;
  }

  let currentHw = null;
  let selectedFile = null;

  async function loadHomework() {
    try {
      const res = await API.get(`/courses/homeworks/${hwId}/`);
      const hw = res.data;
      currentHw = hw;

      document.getElementById('courseTitle').textContent = hw.course_title || 'Kurs darsi';
      document.getElementById('hwTitle').textContent = hw.title;
      
      const typeBadge = document.getElementById('hwTypeBadge');
      typeBadge.textContent = hw.type === 'quiz' ? 'Test' : 'Yozma';
      typeBadge.className = `badge type-${hw.type}`;

      const deadlineBadge = document.getElementById('hwDeadline');
      if (hw.deadline_days) {
        deadlineBadge.textContent = `⏰ ${hw.deadline_days} kun muddat`;
      } else {
        deadlineBadge.textContent = 'Muddat belgilanmagan';
      }

      document.getElementById('hwDescription').textContent = hw.description;

      const sub = hw.my_submission;
      if (sub && (sub.status === 'submitted' || sub.status === 'reviewed')) {
        showResult(hw);
      } else {
        document.getElementById('hwMainContent').style.display = 'block';
        document.getElementById('hwResultCard').style.display = 'none';
        if (hw.type === 'quiz') {
          renderQuiz(hw);
        } else {
          renderWritten(hw);
        }
      }
    } catch (err) {
      window.toast?.show(err.message || "Vazifani yuklashda xatolik", "error");
    }
  }

  function renderQuiz(hw) {
    const formBody = document.getElementById('hwFormBody');
    if (!hw.questions || hw.questions.length === 0) {
      formBody.innerHTML = `<div class="empty-state">📋 Test savollari topilmadi.</div>`;
      return;
    }

    let html = `<div class="hw-quiz-wrapper">`;
    hw.questions.forEach((q, idx) => {
      html += `
        <div class="quiz-question" data-question-id="${q.id}">
          <div class="quiz-q-text">${idx + 1}. ${q.text}</div>
          <div class="quiz-options">
            ${(q.options || []).map(opt => `
              <label class="quiz-option" data-option-id="${opt.id}">
                <input type="radio" name="question_${q.id}" value="${opt.id}">
                <span>${opt.text}</span>
              </label>
            `).join('')}
          </div>
        </div>`;
    });
    html += `
      <button id="submitQuizHwBtn" class="btn-hero" style="width: 100%;">Tekshirish ✓</button>
    </div>`;

    formBody.innerHTML = html;

    // Handle option selection style
    document.querySelectorAll('.quiz-option').forEach(el => {
      el.addEventListener('click', function() {
        const name = this.querySelector('input').name;
        document.querySelectorAll(`input[name="${name}"]`).forEach(input => {
          input.closest('.quiz-option').classList.remove('selected');
        });
        this.classList.add('selected');
      });
    });

    document.getElementById('submitQuizHwBtn').addEventListener('click', submitQuiz);
  }

  async function submitQuiz() {
    const answers = [];
    let complete = true;

    currentHw.questions.forEach(q => {
      const selectedInput = document.querySelector(`input[name="question_${q.id}"]:checked`);
      if (!selectedInput) {
        complete = false;
        answers.push({ question_id: q.id, answer_id: null });
      } else {
        answers.push({ question_id: q.id, answer_id: parseInt(selectedInput.value) });
      }
    });

    if (!complete && !confirm("Barcha savollarga javob bermadingiz. Baribir topshirasizmi?")) {
      return;
    }

    const btn = document.getElementById('submitQuizHwBtn');
    btn.disabled = true;
    btn.textContent = 'Tekshirilmoqda...';

    try {
      await API.post(`/courses/homeworks/${hwId}/submit/`, { answers });
      loadHomework();
    } catch (err) {
      window.toast?.show(err.message || "Xatolik yuz berdi", "error");
      btn.disabled = false;
      btn.textContent = 'Tekshirish ✓';
    }
  }

  function renderWritten(hw) {
    const formBody = document.getElementById('hwFormBody');
    formBody.innerHTML = `
      <div class="hw-written-wrapper">
        <div class="form-group">
          <label>Javobingizni yozing:</label>
          <textarea id="writtenAnswer" rows="8" placeholder="Bu yerga javobingizni batafsil yozib qoldirishingiz mumkin..."></textarea>
        </div>
        <div class="form-group">
          <label>Fayl yuklash (PDF, DOCX, rasm, zip - maks 10MB):</label>
          <div class="file-upload-zone" id="fileZone">
            <input type="file" id="hwFileInput" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip" hidden>
            <span id="fileZoneText">📎 Fayl tanlang yoki shu yerga sudrab tashlang</span>
          </div>
          <div class="file-preview" id="filePreview" style="display: none;">
            <div class="file-preview-info">
              <span class="file-icon">📄</span>
              <span id="fileNameLabel">file.pdf</span>
            </div>
            <span class="file-remove" id="fileRemoveBtn">×</span>
          </div>
        </div>
        <button id="submitWrittenHwBtn" class="btn-hero" style="width: 100%;">Topshirish →</button>
      </div>`;

    const fileZone = document.getElementById('fileZone');
    const fileInput = document.getElementById('hwFileInput');
    const filePreview = document.getElementById('filePreview');
    const fileNameLabel = document.getElementById('fileNameLabel');
    const fileRemoveBtn = document.getElementById('fileRemoveBtn');

    fileZone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
      }
    });

    // Drag and drop support
    fileZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileZone.style.borderColor = 'var(--duo-green)';
    });
    fileZone.addEventListener('dragleave', () => {
      fileZone.style.borderColor = 'var(--border)';
    });
    fileZone.addEventListener('drop', (e) => {
      e.preventDefault();
      fileZone.style.borderColor = 'var(--border)';
      if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });

    fileRemoveBtn.addEventListener('click', () => {
      selectedFile = null;
      fileInput.value = '';
      filePreview.style.display = 'none';
      fileZone.style.display = 'block';
    });

    function handleFileSelect(file) {
      if (file.size > 10 * 1024 * 1024) {
        window.toast?.show("Fayl hajmi 10MB dan oshmasligi kerak", "error");
        return;
      }
      selectedFile = file;
      fileNameLabel.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
      filePreview.style.display = 'flex';
      fileZone.style.display = 'none';
    }

    document.getElementById('submitWrittenHwBtn').addEventListener('click', submitWritten);
  }

  async function submitWritten() {
    const text = document.getElementById('writtenAnswer').value;
    if (!text && !selectedFile) {
      window.toast?.show("Javob matnini yozing yoki fayl yuklang", "warning");
      return;
    }

    const btn = document.getElementById('submitWrittenHwBtn');
    btn.disabled = true;
    btn.textContent = 'Yuborilmoqda...';

    try {
      const fd = new FormData();
      if (text) fd.append('text_answer', text);
      if (selectedFile) fd.append('file_answer', selectedFile);

      await API.post(`/courses/homeworks/${hwId}/submit/`, fd);
      
      loadHomework();
    } catch (err) {
      window.toast?.show(err.message || "Topshirishda xatolik yuz berdi", "error");
      btn.disabled = false;
      btn.textContent = 'Topshirish →';
    }
  }

  function showResult(hw) {
    document.getElementById('hwMainContent').style.display = 'none';
    document.getElementById('hwResultCard').style.display = 'flex';

    const sub = hw.my_submission;
    
    // Default hiding
    document.getElementById('hwQuizScore').style.display = 'none';
    document.getElementById('hwWrittenPending').style.display = 'none';
    document.getElementById('hwTeacherFeedback').style.display = 'none';

    if (hw.type === 'quiz') {
      document.getElementById('hwQuizScore').style.display = 'block';
      const score = Math.round(sub.score || sub.quiz_score || 0);
      document.getElementById('scorePercent').textContent = `${score}%`;
      
      const passed = score >= 70;
      document.getElementById('hwResultIcon').textContent = passed ? '🎉' : '😔';
      document.getElementById('hwResultTitle').textContent = passed ? "Ajoyib! O'tdingiz" : "Qayta urinib ko'ring";
      document.getElementById('hwResultMessage').textContent = passed 
        ? "Siz dars testidan muvaffaqiyatli o'tdingiz. Kursingizni davom ettirishingiz mumkin."
        : "O'tish balli 70%. Iltimos, dars materialini qayta ko'rib chiqing va urinib ko'ring.";

      const offset = 213.6 - (213.6 * (score / 100));
      document.getElementById('scoreRingCircle').style.strokeDashoffset = offset;
    } else {
      // Written
      if (sub.status === 'submitted') {
        document.getElementById('hwWrittenPending').style.display = 'block';
        document.getElementById('hwResultIcon').textContent = '✅';
        document.getElementById('hwResultTitle').textContent = 'Topshirildi!';
        document.getElementById('hwResultMessage').textContent = 'Vazifangiz ustoz tekshiruviga yuborildi.';
      } else if (sub.status === 'reviewed') {
        document.getElementById('hwTeacherFeedback').style.display = 'block';
        document.getElementById('hwResultIcon').textContent = '📝';
        document.getElementById('hwResultTitle').textContent = 'Tekshirildi';
        document.getElementById('hwResultMessage').textContent = 'Ustoz sizning javobingizni baholadi.';
        document.getElementById('feedbackText').textContent = sub.feedback || 'Izoh qoldirilmagan.';
        document.getElementById('feedbackScore').textContent = `${sub.teacher_score}/100`;
      }
    }
  }

  // Set student profile trigger
  const user = Auth.getUser();
  if (user) {
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
      avatar.textContent = user.first_name ? (user.first_name[0] + (user.last_name ? user.last_name[0] : '')).toUpperCase() : 'U';
    }
  }

  loadHomework();
});
