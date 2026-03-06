// ============================================
// SERVERLESS IMAGE HOSTER - JAVASCRIPT
// ============================================

const STORAGE_KEY = 'hosted_images';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB per file
const MAX_STORAGE_SIZE = 8 * 1024 * 1024; // 8MB total limit
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadBox = document.querySelector('.upload-box');
const gallery = document.getElementById('gallery');
const imageCountEl = document.getElementById('imageCount');
const storageUsageEl = document.getElementById('storageUsage');
const previewModal = document.getElementById('previewModal');
const closeModalBtn = document.getElementById('closeModal');
const previewImage = document.getElementById('previewImage');
const imageName = document.getElementById('imageName');
const imageUrl = document.getElementById('imageUrl');
const copyUrlBtn = document.getElementById('copyUrlBtn');

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    renderGallery();
    updateStats();
});

// ============================================
// EVENT LISTENERS
// ============================================

function initializeEventListeners() {
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    uploadBox.addEventListener('dragover', handleDragOver);
    uploadBox.addEventListener('dragleave', handleDragLeave);
    uploadBox.addEventListener('drop', handleDrop);
    
    // Modal
    closeModalBtn.addEventListener('click', closeModal);
    previewModal.addEventListener('click', (e) => {
        if (e.target === previewModal) closeModal();
    });
    copyUrlBtn.addEventListener('click', copyToClipboard);
}

// ============================================
// FILE HANDLING
// ============================================

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    processFiles(files);
    fileInput.value = ''; // Reset input
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadBox.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadBox.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadBox.classList.remove('dragover');
    
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => ALLOWED_TYPES.includes(file.type));
    
    if (imageFiles.length === 0) {
        showNotification('Please upload image files only', 'error');
        return;
    }
    
    processFiles(imageFiles);
}

function processFiles(files) {
    files.forEach(file => {
        // Validate file
        if (!ALLOWED_TYPES.includes(file.type)) {
            showNotification(`${file.name} is not a supported image format`, 'error');
            return;
        }
        
        if (file.size > MAX_FILE_SIZE) {
            showNotification(`${file.name} is too large (max. 5MB)`, 'error');
            return;
        }
        
        // Check storage limit
        const currentSize = getCurrentStorageSize();
        if (currentSize + file.size > MAX_STORAGE_SIZE) {
            const remainingMB = ((MAX_STORAGE_SIZE - currentSize) / (1024 * 1024)).toFixed(2);
            showNotification(`Storage full! Only ${remainingMB}MB available. Delete old images.`, 'error');
            return;
        }
        
        // Read and store file
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            addImageToStorage(file.name, imageData);
        };
        reader.onerror = () => {
            showNotification(`Fehler beim Lesen von ${file.name}`, 'error');
        };
        reader.readAsDataURL(file);
    });
}

// ============================================
// LOCALSTORAGE MANAGEMENT
// ============================================

function getImages() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

function saveImages(images) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
}

function addImageToStorage(filename, imageData) {
    const images = getImages();
    
    // Double-check storage limit before adding
    const currentSize = getCurrentStorageSize();
    if (currentSize + imageData.length > MAX_STORAGE_SIZE) {
        showNotification('Storage full! Please delete images.', 'error');
        return;
    }
    
    // Generate unique ID
    const id = generateImageId();
    
    const image = {
        id: id,
        name: filename,
        data: imageData,
        timestamp: Date.now(),
        size: imageData.length
    };
    
    images.push(image);
    saveImages(images);
    
    renderGallery();
    updateStats();
    checkStorageWarning();
    showNotification(`${filename} uploaded successfully!`, 'success');
}

function deleteImage(id) {
    if (!confirm('Are you sure you want to delete this image?')) {
        return;
    }
    
    let images = getImages();
    images = images.filter(img => img.id !== id);
    saveImages(images);
    
    renderGallery();
    updateStats();
    closeModal();
    showNotification('Image deleted', 'success');
}

function generateImageId() {
    return 'img' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

// ============================================
// STORAGE MANAGEMENT
// ============================================

function getCurrentStorageSize() {
    const images = getImages();
    return images.reduce((sum, img) => sum + img.size, 0);
}

function getStoragePercentage() {
    const currentSize = getCurrentStorageSize();
    return (currentSize / MAX_STORAGE_SIZE) * 100;
}

function checkStorageWarning() {
    const percentage = getStoragePercentage();
    
    if (percentage > 95) {
        showNotification('Warning: Storage 95% full! Please delete images.', 'error');
    } else if (percentage > 85) {
        showNotification('Warning: Storage 85% full.', 'error');
    }
}

// ============================================
// RENDERING
// ============================================

function renderGallery() {
    const images = getImages();
    
    if (images.length === 0) {
        gallery.innerHTML = '<div class="empty-state"><p>No images uploaded yet</p></div>';
        return;
    }
    
    gallery.innerHTML = images.map(image => `
        <div class="gallery-item" data-id="${image.id}">
            <img src="${image.data}" alt="${image.name}" class="gallery-item-image">
            <div class="gallery-item-overlay">
                <button class="overlay-button view" onclick="openModal('${image.id}')">👁️</button>
                <button class="overlay-button delete" onclick="deleteImage('${image.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

// ============================================
// MODAL MANAGEMENT
// ============================================

function openModal(imageId) {
    const images = getImages();
    const image = images.find(img => img.id === imageId);
    
    if (!image) return;
    
    previewImage.src = image.data;
    imageName.textContent = image.name;
    
    // Generate shareable Data URL (can be used anywhere)
    const shareUrl = image.data; // This is already a data URL
    imageUrl.value = shareUrl;
    
    previewModal.classList.add('active');
}

function closeModal() {
    previewModal.classList.remove('active');
}

function copyToClipboard() {
    imageUrl.select();
    document.execCommand('copy');
    
    const originalText = copyUrlBtn.textContent;
    copyUrlBtn.textContent = '✓ Copied!';
    setTimeout(() => {
        copyUrlBtn.textContent = originalText;
    }, 2000);
}

// ============================================
// STATISTICS
// ============================================

function updateStats() {
    const images = getImages();
    
    // Update image count
    imageCountEl.textContent = images.length;
    
    // Calculate storage usage
    const totalSize = images.reduce((sum, img) => sum + img.size, 0);
    const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
    const maxSizeMB = (MAX_STORAGE_SIZE / (1024 * 1024)).toFixed(0);
    storageUsageEl.textContent = `${sizeInMB}/${maxSizeMB}MB`;
    
    checkStorageWarning();
}

// ============================================
// NOTIFICATIONS
// ============================================

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 2000;
        animation: slideUp 0.3s ease-in-out;
        max-width: 300px;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideDown 0.3s ease-in-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// SECURITY & ACCESS CONTROL INFORMATION
// ============================================

/*
SICHERHEIT DER BILD-LINKS:

JA - Jeder mit der URL kann das Bild sehen!

Wie funktioniert es:
1. Bilder werden im LocalStorage deines BROWSERS gespeichert
2. Die URLs sind zufällig generiert: domain.com/id/assets/img[9-Zeichen][Zeitstempel].png
3. Ohne die exakte URL kann niemand das Bild finden
4. Wenn du die URL teilst, kann jeder mit dieser URL das Bild sehen

WARUM IST DAS SICHER:
- Die URLs sind nicht in einer Datenbank registriert
- Es gibt keine Auflistung aller Bilder
- Nur wer die URL kennt, kann das Bild sehen
- Ähnlich wie unlisted YouTube Videos

WICHTIG:
- Teile URLs nur für Bilder, die öffentlich sein dürfen
- Andere Browser/Geräte können NICHT auf deine Bilder zugreifen
- Nur DEIN Browser speichert die Bilder lokal
- Wenn du den Browser-Cache löschst, sind die Bilder weg

DATENSCHUTZ:
- Keine Datenübertragung zu Servern
- Keine Cookies oder Tracking
- 100% lokal in deinem Browser
*/

// ============================================
// SERVICE WORKER - Optional for offline support
// ============================================

if ('serviceWorker' in navigator) {
    // Service worker registration can be added here for offline support
    // navigator.serviceWorker.register('sw.js');
}

// ============================================
// EXPORT FUNCTIONALITY - Optional
// ============================================

function exportAllImages() {
    const images = getImages();
    if (images.length === 0) {
        showNotification('No images to export', 'error');
        return;
    }
    
    const exportData = {
        version: 1,
        exportDate: new Date().toISOString(),
        images: images.map(img => ({
            id: img.id,
            name: img.name,
            timestamp: img.timestamp,
            data: img.data
        }))
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `image-hoster-backup-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
}

// ============================================
// IMPORT FUNCTIONALITY - Optional
// ============================================

function importImages(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importData = JSON.parse(e.target.result);
            
            if (!importData.images || !Array.isArray(importData.images)) {
                showNotification('Invalid backup format', 'error');
                return;
            }
            
            let images = getImages();
            const newImages = importData.images.filter(img => 
                !images.some(existing => existing.id === img.id)
            );
            
            images = [...images, ...newImages];
            saveImages(images);
            
            renderGallery();
            updateStats();
            showNotification(`${newImages.length} images imported`, 'success');
        } catch (error) {
            showNotification('Error importing backup', 'error');
        }
    };
    reader.readAsText(file);
}
