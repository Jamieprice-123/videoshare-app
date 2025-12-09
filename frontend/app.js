// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:7071/api' 
    : 'https://videoshare-api-jp.azurewebsites.net/api';

// DOM Elements
const videoGrid = document.getElementById('videoGrid');
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const uploadForm = document.getElementById('uploadForm');
const uploadZone = document.getElementById('uploadZone');
const videoInput = document.getElementById('videoInput');
const videoTitle = document.getElementById('videoTitle');
const videoDescription = document.getElementById('videoDescription');
const uploadBtn = document.getElementById('uploadBtn');
const uploadProgress = document.getElementById('uploadProgress');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const selectedFile = document.getElementById('selectedFile');
const fileName = document.getElementById('fileName');
const clearFile = document.getElementById('clearFile');
const playerModal = document.getElementById('playerModal');
const playerTitle = document.getElementById('playerTitle');
const videoPlayer = document.getElementById('videoPlayer');
const playerViews = document.getElementById('playerViews');
const playerDate = document.getElementById('playerDate');
const deleteVideoBtn = document.getElementById('deleteVideoBtn');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');
const searchResultsCount = document.getElementById('searchResultsCount');
const resultsText = document.getElementById('resultsText');
const noResultsState = document.getElementById('noResultsState');

let selectedVideoFile = null;
let allVideos = [];
let currentCategory = 'all';
let currentVideoData = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadVideos();
    setupEventListeners();
});

function setupEventListeners() {
    // Upload zone click
    uploadZone.addEventListener('click', () => videoInput.click());
    
    // File input change
    videoInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
    
    // Clear file
    clearFile.addEventListener('click', () => {
        selectedVideoFile = null;
        videoInput.value = '';
        selectedFile.classList.add('d-none');
        uploadBtn.disabled = true;
    });
    
    // Upload button
    uploadBtn.addEventListener('click', uploadVideo);
    
    // Delete video button
    deleteVideoBtn.addEventListener('click', () => {
        if (currentVideoData) {
            deleteVideo(currentVideoData.id, currentVideoData.userId);
        }
    });
    
    // Stop video when modal closes
    playerModal.addEventListener('hidden.bs.modal', () => {
        videoPlayer.pause();
        videoPlayer.src = '';
    });

    // Search functionality
    searchInput.addEventListener('input', handleSearch);
    searchClear.addEventListener('click', clearSearch);

    // Category filter
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.category;
            filterVideos();
        });
    });
}

function handleFileSelect(e) {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
}

function handleFile(file) {
    if (!file.type.startsWith('video/')) {
        showToast('Please select a video file', 'danger');
        return;
    }
    selectedVideoFile = file;
    fileName.textContent = file.name;
    selectedFile.classList.remove('d-none');
    uploadBtn.disabled = false;
}

async function loadVideos() {
    try {
        loadingState.classList.remove('d-none');
        videoGrid.innerHTML = '';
        emptyState.classList.add('d-none');
        noResultsState.classList.add('d-none');
        
        const response = await fetch(`${API_BASE_URL}/videos`);
        if (!response.ok) throw new Error('Failed to fetch videos');
        
        allVideos = await response.json();
        
        loadingState.classList.add('d-none');
        
        if (allVideos.length === 0) {
            emptyState.classList.remove('d-none');
            return;
        }
        
        displayVideos(allVideos);
    } catch (error) {
        console.error('Error loading videos:', error);
        loadingState.classList.add('d-none');
        showToast('Failed to load videos', 'danger');
    }
}

function displayVideos(videos) {
    videoGrid.innerHTML = '';
    emptyState.classList.add('d-none');
    noResultsState.classList.add('d-none');
    
    if (videos.length === 0) {
        if (searchInput.value.trim()) {
            noResultsState.classList.remove('d-none');
        } else {
            emptyState.classList.remove('d-none');
        }
        return;
    }
    
    videos.forEach(video => {
        videoGrid.appendChild(createVideoCard(video));
    });
}

function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();
    
    if (query) {
        searchClear.classList.remove('d-none');
    } else {
        searchClear.classList.add('d-none');
    }
    
    filterVideos();
}

function clearSearch() {
    searchInput.value = '';
    searchClear.classList.add('d-none');
    filterVideos();
}

function filterVideos() {
    let filtered = allVideos;
    
    // Apply category filter
    if (currentCategory !== 'all') {
        filtered = filtered.filter(video => video.category === currentCategory);
    }
    
    // Apply search filter
    const query = searchInput.value.trim().toLowerCase();
    if (query) {
        filtered = filtered.filter(video => 
            video.title.toLowerCase().includes(query) ||
            (video.description && video.description.toLowerCase().includes(query))
        );
    }
    
    displayVideos(filtered);
    
    // Update results count
    if (query || currentCategory !== 'all') {
        searchResultsCount.classList.remove('d-none');
        resultsText.textContent = `${filtered.length} video${filtered.length !== 1 ? 's' : ''} found`;
    } else {
        searchResultsCount.classList.add('d-none');
    }
}

function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = () => playVideo(video);
    
    const categoryEmojis = {
        entertainment: '🎬',
        gaming: '🎮',
        music: '🎵',
        education: '📚',
        sports: '⚽',
        tech: '💻',
        travel: '✈️',
        other: '📁'
    };
    
    const categoryEmoji = categoryEmojis[video.category] || '📁';
    const categoryName = video.category ? video.category.charAt(0).toUpperCase() + video.category.slice(1) : 'Other';
    
    card.innerHTML = `
        <div class="video-thumbnail">
            <video src="${video.videoUrl}" preload="metadata"></video>
            <div class="video-overlay">
                <div class="play-btn">
                    <i class="bi bi-play-fill"></i>
                </div>
            </div>
            ${video.category ? `<span class="video-category-badge">${categoryEmoji} ${categoryName}</span>` : ''}
        </div>
        <div class="video-info">
            <h3 class="video-title">${escapeHtml(video.title)}</h3>
            <div class="video-meta">
                <span><i class="bi bi-eye"></i> ${video.views || 0} views</span>
                <span><i class="bi bi-clock"></i> ${formatDate(video.uploadDate)}</span>
            </div>
        </div>
    `;
    
    return card;
}

async function playVideo(video) {
    currentVideoData = video;
    
    playerTitle.textContent = video.title;
    playerViews.textContent = `${video.views || 0} views`;
    playerDate.textContent = formatDate(video.uploadDate);
    videoPlayer.src = video.videoUrl;
    
    // Update likes display
    const playerLikes = document.getElementById('playerLikes');
    const likeBtn = document.getElementById('likeBtn');
    if (playerLikes) {
        playerLikes.textContent = `${video.likes || 0} likes`;
    }
    if (likeBtn) {
        const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
        if (likedVideos.includes(video.id)) {
            likeBtn.classList.add('liked');
            likeBtn.innerHTML = '<i class="bi bi-heart-fill me-1"></i>Liked';
        } else {
            likeBtn.classList.remove('liked');
            likeBtn.innerHTML = '<i class="bi bi-heart me-1"></i>Like';
        }
    }
    
    // Reset transcript UI
    const transcribeBtn = document.getElementById('transcribeBtn');
    const transcriptStatus = document.getElementById('transcriptStatus');
    const transcriptContent = document.getElementById('transcriptContent');
    
    transcribeBtn.classList.remove('d-none');
    transcribeBtn.disabled = false;
    transcriptStatus.classList.add('d-none');
    
    if (video.transcript) {
        transcriptContent.innerHTML = `<p style="margin: 0;">${escapeHtml(video.transcript)}</p>`;
        transcribeBtn.classList.add('d-none');
    } else {
        transcriptContent.innerHTML = `<span style="color: var(--text-muted); font-style: italic;">No transcript available. Click "Generate" to create one.</span>`;
    }
    
    const modal = new bootstrap.Modal(playerModal);
    modal.show();
    
    // Increment view count
    try {
        const response = await fetch(`${API_BASE_URL}/videos/${video.id}`);
        if (response.ok) {
            const updatedVideo = await response.json();
            currentVideoData = updatedVideo;
            playerViews.textContent = `${updatedVideo.views || 0} views`;
            if (playerLikes) {
                playerLikes.textContent = `${updatedVideo.likes || 0} likes`;
            }
            loadVideos();
        }
    } catch (error) {
        console.error('Error updating view count:', error);
    }
}

async function uploadVideo() {
    if (!selectedVideoFile) return;
    
    const title = videoTitle.value.trim();
    if (!title) {
        showToast('Please enter a title', 'danger');
        return;
    }
    
    uploadBtn.disabled = true;
    uploadProgress.classList.remove('d-none');
    
    const formData = new FormData();
    formData.append('video', selectedVideoFile);
    formData.append('title', title);
    formData.append('description', videoDescription.value.trim());
    formData.append('category', document.getElementById('videoCategory').value || 'other');
    formData.append('userId', 'user-' + Date.now());    

    try {
        const response = await fetch(`${API_BASE_URL}/videos`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Upload failed');
        
        // Simulate progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += 10;
            progressBar.style.width = `${progress}%`;
            progressPercent.textContent = `${progress}%`;
            if (progress >= 100) {
                clearInterval(interval);
            }
        }, 100);
        
        await response.json();
        
        setTimeout(() => {
            showToast('Video uploaded successfully!', 'success');
            
            // Reset form
            selectedVideoFile = null;
            videoInput.value = '';
            videoTitle.value = '';
            videoDescription.value = '';
            document.getElementById('videoCategory').value = '';
            selectedFile.classList.add('d-none');
            uploadProgress.classList.add('d-none');
            progressBar.style.width = '0%';
            uploadBtn.disabled = true;
            
            // Close modal and reload
            bootstrap.Modal.getInstance(document.getElementById('uploadModal')).hide();
            loadVideos();
        }, 1000);
    } catch (error) {
        console.error('Error uploading video:', error);
        showToast('Failed to upload video', 'danger');
        uploadBtn.disabled = false;
        uploadProgress.classList.add('d-none');
    }
}

async function deleteVideo(videoId, userId) {
    if (!confirm('Are you sure you want to delete this video?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/videos/${videoId}?userId=${userId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Delete failed');
        
        showToast('Video deleted successfully', 'success');
        bootstrap.Modal.getInstance(playerModal).hide();
        loadVideos();
    } catch (error) {
        console.error('Error deleting video:', error);
        showToast('Failed to delete video', 'danger');
    }
}

// Transcription Functions
async function transcribeCurrentVideo() {
    if (!currentVideoData) return;
    
    const transcribeBtn = document.getElementById('transcribeBtn');
    const transcriptStatus = document.getElementById('transcriptStatus');
    const transcriptContent = document.getElementById('transcriptContent');
    
    transcribeBtn.disabled = true;
    transcriptStatus.classList.remove('d-none');
    
    try {
        const response = await fetch(`${API_BASE_URL}/videos/${currentVideoData.id}/transcribe`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.transcript) {
            transcriptContent.innerHTML = `<p style="margin: 0;">${escapeHtml(result.transcript)}</p>`;
            transcriptStatus.classList.add('d-none');
            transcribeBtn.classList.add('d-none');
        } else if (result.transcriptionStatus === 'processing') {
            showToast('Transcription started! This may take a few moments...', 'info');
            pollTranscriptionStatus(currentVideoData.id);
        }
    } catch (error) {
        console.error('Error starting transcription:', error);
        showToast('Failed to start transcription', 'danger');
        transcriptStatus.classList.add('d-none');
        transcribeBtn.disabled = false;
    }
}

async function pollTranscriptionStatus(videoId) {
    const transcribeBtn = document.getElementById('transcribeBtn');
    const transcriptStatus = document.getElementById('transcriptStatus');
    const transcriptContent = document.getElementById('transcriptContent');
    
    let attempts = 0;
    const maxAttempts = 30;
    
    const poll = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/videos/${videoId}/transcript`);
            const result = await response.json();
            
            if (result.transcriptionStatus === 'completed' && result.transcript) {
                transcriptContent.innerHTML = `<p style="margin: 0;">${escapeHtml(result.transcript)}</p>`;
                transcriptStatus.classList.add('d-none');
                transcribeBtn.classList.add('d-none');
                showToast('Transcription complete!', 'success');
                return;
            } else if (result.transcriptionStatus === 'failed') {
                transcriptContent.innerHTML = `<span style="color: var(--danger);">Transcription failed. Please try again.</span>`;
                transcriptStatus.classList.add('d-none');
                transcribeBtn.disabled = false;
                showToast('Transcription failed', 'danger');
                return;
            }
            
            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(poll, 2000);
            } else {
                transcriptContent.innerHTML = `<span style="color: var(--text-muted);">Transcription is taking longer than expected. Please check back later.</span>`;
                transcriptStatus.classList.add('d-none');
                transcribeBtn.disabled = false;
            }
        } catch (error) {
            console.error('Error polling transcription:', error);
            transcriptStatus.classList.add('d-none');
            transcribeBtn.disabled = false;
        }
    };
    
    poll();
}

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    const container = document.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type} show`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="toast-body d-flex align-items-center gap-2 p-3">
            <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'danger' ? 'exclamation-circle' : 'info-circle'}"></i>
            ${message}
        </div>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

// Like Video Function
async function likeVideo() {
    if (!currentVideoData) return;
    
    const likeBtn = document.getElementById('likeBtn');
    const playerLikes = document.getElementById('playerLikes');
    
    // Check if already liked in localStorage
    const likedVideos = JSON.parse(localStorage.getItem('likedVideos') || '[]');
    const isLiked = likedVideos.includes(currentVideoData.id);
    const action = isLiked ? 'unlike' : 'like';
    
    try {
        const response = await fetch(`${API_BASE_URL}/videos/${currentVideoData.id}/like`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        
        if (response.ok) {
            const result = await response.json();
            playerLikes.textContent = `${result.likes} likes`;
            currentVideoData.likes = result.likes;
            
            // Update localStorage
            if (action === 'like') {
                likedVideos.push(currentVideoData.id);
                likeBtn.classList.add('liked');
                likeBtn.innerHTML = '<i class="bi bi-heart-fill me-1"></i>Liked';
                showToast('Video liked!', 'success');
            } else {
                const index = likedVideos.indexOf(currentVideoData.id);
                if (index > -1) likedVideos.splice(index, 1);
                likeBtn.classList.remove('liked');
                likeBtn.innerHTML = '<i class="bi bi-heart me-1"></i>Like';
            }
            localStorage.setItem('likedVideos', JSON.stringify(likedVideos));
            
            loadVideos();
        }
    } catch (error) {
        console.error('Error liking video:', error);
        showToast('Failed to like video', 'danger');
    }
}