// API Configuration
const API_BASE_URL = 'https://videoshare-api-jp.azurewebsites.net/api';

// DOM Elements
const videoGrid = document.getElementById('videoGrid');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const uploadForm = document.getElementById('uploadForm');
const uploadArea = document.getElementById('uploadArea');
const videoInput = document.getElementById('videoInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const clearFile = document.getElementById('clearFile');
const videoTitle = document.getElementById('videoTitle');
const videoDescription = document.getElementById('videoDescription');
const uploadBtn = document.getElementById('uploadBtn');
const uploadProgress = document.getElementById('uploadProgress');
const progressBar = document.querySelector('.progress-bar');
const uploadStatus = document.getElementById('uploadStatus');
const uploadModal = document.getElementById('uploadModal');
const playerModal = document.getElementById('playerModal');
const videoPlayer = document.getElementById('videoPlayer');
const playerTitle = document.getElementById('playerTitle');
const playerMeta = document.getElementById('playerMeta');

let selectedFile = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadVideos();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Upload area click
    uploadArea.addEventListener('click', () => videoInput.click());
    
    // File input change
    videoInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('video/')) {
            handleFile(files[0]);
        }
    });
    
    // Clear file
    clearFile.addEventListener('click', resetFileInput);
    
    // Upload button
    uploadBtn.addEventListener('click', uploadVideo);
    
    // Modal reset
    uploadModal.addEventListener('hidden.bs.modal', resetUploadForm);
    
    // Player modal - stop video on close
    playerModal.addEventListener('hidden.bs.modal', () => {
        videoPlayer.pause();
        videoPlayer.src = '';
    });
}

// File handling
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFile(file) {
    if (!file.type.startsWith('video/')) {
        showToast('Please select a video file', 'danger');
        return;
    }
    
    selectedFile = file;
    fileName.textContent = `${file.name} (${formatFileSize(file.size)})`;
    fileInfo.classList.remove('d-none');
    uploadArea.classList.add('d-none');
    uploadBtn.disabled = false;
}

function resetFileInput() {
    selectedFile = null;
    videoInput.value = '';
    fileInfo.classList.add('d-none');
    uploadArea.classList.remove('d-none');
    uploadBtn.disabled = true;
}

function resetUploadForm() {
    resetFileInput();
    videoTitle.value = '';
    videoDescription.value = '';
    uploadProgress.classList.add('d-none');
    progressBar.style.width = '0%';
}

// API Functions
async function loadVideos() {
    try {
        loadingState.classList.remove('d-none');
        videoGrid.classList.add('d-none');
        emptyState.classList.add('d-none');
        
        const response = await fetch(`${API_BASE_URL}/videos`);
        const videos = await response.json();
        
        loadingState.classList.add('d-none');
        
        if (videos.length === 0) {
            emptyState.classList.remove('d-none');
        } else {
            renderVideos(videos);
            videoGrid.classList.remove('d-none');
        }
    } catch (error) {
        console.error('Error loading videos:', error);
        loadingState.classList.add('d-none');
        showToast('Failed to load videos', 'danger');
    }
}

async function uploadVideo() {
    if (!selectedFile) return;
    
    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('title', videoTitle.value || 'Untitled');
    formData.append('description', videoDescription.value || '');
    formData.append('userId', 'user-' + Date.now());
    
    uploadBtn.disabled = true;
    uploadProgress.classList.remove('d-none');
    uploadStatus.textContent = 'Uploading video...';
    
    // Simulate progress (actual progress tracking would need XHR)
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        progressBar.style.width = `${progress}%`;
    }, 200);
    
    try {
        const response = await fetch(`${API_BASE_URL}/videos`, {
            method: 'POST',
            body: formData
        });
        
        clearInterval(progressInterval);
        progressBar.style.width = '100%';
        uploadStatus.textContent = 'Upload complete!';
        
        if (response.ok) {
            const video = await response.json();
            showToast('Video uploaded successfully!', 'success');
            
            setTimeout(() => {
                bootstrap.Modal.getInstance(uploadModal).hide();
                loadVideos();
            }, 1000);
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
        }
    } catch (error) {
        clearInterval(progressInterval);
        console.error('Error uploading video:', error);
        showToast(`Upload failed: ${error.message}`, 'danger');
        uploadProgress.classList.add('d-none');
        uploadBtn.disabled = false;
    }
}

async function deleteVideo(videoId) {
    if (!confirm('Are you sure you want to delete this video?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/videos/${videoId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Video deleted successfully', 'success');
            loadVideos();
        } else {
            throw new Error('Delete failed');
        }
    } catch (error) {
        console.error('Error deleting video:', error);
        showToast('Failed to delete video', 'danger');
    }
}

function playVideo(video) {
    playerTitle.textContent = video.title;
    playerMeta.textContent = `${video.views || 0} views • ${formatDate(video.uploadDate)}`;
    videoPlayer.src = video.videoUrl;
    
    const modal = new bootstrap.Modal(playerModal);
    modal.show();
    
    // Auto-play when modal opens
    playerModal.addEventListener('shown.bs.modal', () => {
        videoPlayer.play();
    }, { once: true });
}

// Rendering
function renderVideos(videos) {
    videoGrid.innerHTML = videos.map(video => `
        <div class="col-12 col-sm-6 col-lg-4 col-xl-3">
            <div class="video-card card h-100" data-video-id="${video.id}">
                <div class="video-thumbnail" onclick="playVideo(${JSON.stringify(video).replace(/"/g, '&quot;')})">
                    <video src="${video.videoUrl}" muted preload="metadata"></video>
                    <button class="delete-btn text-white" onclick="event.stopPropagation(); deleteVideo('${video.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
                <div class="video-info">
                    <h6 class="video-title text-truncate">${escapeHtml(video.title)}</h6>
                    <p class="video-meta mb-0">
                        <i class="bi bi-eye me-1"></i>${video.views || 0} views
                        <span class="mx-2">•</span>
                        ${formatDate(video.uploadDate)}
                    </p>
                </div>
            </div>
        </div>
    `).join('');
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    const toastId = 'toast-' + Date.now();
    
    const bgClass = {
        'success': 'bg-success',
        'danger': 'bg-danger',
        'warning': 'bg-warning',
        'info': 'bg-primary'
    }[type] || 'bg-primary';
    
    const toastHtml = `
        <div id="${toastId}" class="toast ${bgClass} text-white" role="alert">
            <div class="toast-body d-flex align-items-center">
                <span>${message}</span>
                <button type="button" class="btn-close btn-close-white ms-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    const toastEl = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastEl, { autohide: true, delay: 3000 });
    toast.show();
    
    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}