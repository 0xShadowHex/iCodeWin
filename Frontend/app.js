// Monaco Editor Application with Dashboard and Drag-and-Drop
class MonacoEditorApp {
    constructor() {
        this.editor = null;
        this.currentFile = null;
        this.currentProject = null;
        this.openTabs = new Map();
        this.projectStructure = {
            html: [],
            css: [],
            js: []
        };
        this.contextMenu = document.getElementById('contextMenu');
        this.modal = document.getElementById('modal');
        this.modalAction = null;
        this.modalContext = null;
        this.hasOpenedFile = false;
        this.projects = [];

        this.init();
    }

    async init() {
        this.loadProjects();
        this.showDashboard();
        this.setupEventListeners();
    }

    // ===== DASHBOARD FUNCTIONS =====
    loadProjects() {
        const stored = localStorage.getItem('iCodeWinProjects');
        this.projects = stored ? JSON.parse(stored) : [];
    }

    saveProjects() {
        localStorage.setItem('iCodeWinProjects', JSON.stringify(this.projects));
    }

    showDashboard() {
        document.getElementById('dashboardContainer').classList.add('active');
        document.getElementById('appContainer').classList.remove('active');
        this.renderDashboard();
    }

    renderDashboard() {
        const projectsContainer = document.getElementById('dashboardProjects');
        projectsContainer.innerHTML = '';

        // Add create project button
        const createCard = document.createElement('div');
        createCard.className = 'create-project-card';
        createCard.onclick = () => this.createNewProject();
        createCard.innerHTML = `
            <div class="create-project-icon">+</div>
            <div class="create-project-label">New Project</div>
        `;
        projectsContainer.appendChild(createCard);

        // Add existing projects
        this.projects.forEach(project => {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.onclick = () => this.openProject(project.id);

            const iconSrc = project.icon || './ressources/project-icon.jpg';

            card.innerHTML = `
                <div class="project-icon-wrapper" style="position: relative;">
                    <img src="${iconSrc}" alt="${project.name}">
                    <div class="change-icon-btn" onclick="event.stopPropagation(); app.triggerIconUpload('${project.id}')" style="
                        position: absolute;
                        bottom: 5px;
                        right: 5px;
                        background: rgba(0,0,0,0.6);
                        color: white;
                        border-radius: 50%;
                        width: 24px;
                        height: 24px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 12px;
                        cursor: pointer;
                    ">
                        <i class="fas fa-camera"></i>
                    </div>
                </div>
                <div class="project-name">${project.name}</div>
            `;

            card.oncontextmenu = (e) => {
                e.preventDefault();
                this.showProjectContextMenu(e, project.id, project.name);
            };

            projectsContainer.appendChild(card);
        });

        // Add hidden file input for icon upload if it doesn't exist
        if (!document.getElementById('iconUploadInput')) {
            const input = document.createElement('input');
            input.type = 'file';
            input.id = 'iconUploadInput';
            input.accept = 'image/*';
            input.style.display = 'none';
            input.onchange = (e) => this.handleIconUpload(e);
            document.body.appendChild(input);
        }
    }

    triggerIconUpload(projectId) {
        this.uploadingIconProjectId = projectId;
        document.getElementById('iconUploadInput').click();
    }

    handleIconUpload(event) {
        const file = event.target.files[0];
        if (!file || !this.uploadingIconProjectId) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const project = this.projects.find(p => p.id === this.uploadingIconProjectId);
            if (project) {
                project.icon = e.target.result;
                this.saveProjects();
                this.renderDashboard();
            }
        };
        reader.readAsDataURL(file);
    }

    createNewProject() {
        const projectName = prompt('Enter project name:');
        if (!projectName) return;

        const projectId = 'project_' + Date.now();
        const newProject = {
            id: projectId,
            name: projectName,
            files: {
                html: {},
                css: {},
                js: {}
            }
        };

        // Add default files
        newProject.files.html['index.html'] = this.getDefaultHtmlContent('index.html');
        newProject.files.css['style.css'] = this.getDefaultCssContent();
        newProject.files.js['script.js'] = this.getDefaultJsContent();

        this.projects.push(newProject);
        this.saveProjects();
        this.openProject(projectId);
    }

    openProject(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;

        this.currentProject = project;
        this.projectStructure = {
            html: Object.keys(project.files.html),
            css: Object.keys(project.files.css),
            js: Object.keys(project.files.js || {})
        };

        // Load files into openTabs
        this.openTabs.clear();
        Object.entries(project.files.html).forEach(([filename, content]) => {
            const fileKey = `html/${filename}`;
            this.openTabs.set(fileKey, {
                folder: 'html',
                filename,
                content,
                modified: false,
                language: 'html'
            });
        });
        Object.entries(project.files.css).forEach(([filename, content]) => {
            const fileKey = `css/${filename}`;
            this.openTabs.set(fileKey, {
                folder: 'css',
                filename,
                content,
                modified: false,
                language: 'css'
            });
        });
        Object.entries(project.files.js || {}).forEach(([filename, content]) => {
            const fileKey = `js/${filename}`;
            this.openTabs.set(fileKey, {
                folder: 'js',
                filename,
                content,
                modified: false,
                language: 'javascript'
            });
        });

        // Show editor
        document.getElementById('dashboardContainer').classList.remove('active');
        document.getElementById('appContainer').classList.add('active');
        document.getElementById('projectTitle').textContent = project.name;

        this.renderProjectTree();
        this.setupDragAndDrop();
        this.loadMonacoEditor().then(() => {
            if (this.projectStructure.html.includes('index.html')) {
                this.openFile('html', 'index.html');
            } else if (this.projectStructure.html.length > 0) {
                this.openFile('html', this.projectStructure.html[0]);
            } else {
                this.showWelcomeScreen();
            }
            this.hideLoadingSpinner();
        });
    }

    backToDashboard() {
        if (this.currentFile) {
            this.saveFileContent();
        }
        this.currentProject = null;
        this.currentFile = null;
        this.openTabs.clear();
        if (this.editor) {
            this.editor.dispose();
            this.editor = null;
        }
        this.showDashboard();
    }

    // ===== DRAG AND DROP FUNCTIONS =====
    setupDragAndDrop() {
        const wrapper = document.getElementById('editorWrapper');
        const overlay = document.getElementById('dragOverlay');

        wrapper.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            wrapper.classList.add('drag-over');
            overlay.classList.add('active');
        });

        wrapper.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            wrapper.classList.remove('drag-over');
            overlay.classList.remove('active');
        });

        wrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            wrapper.classList.remove('drag-over');
            overlay.classList.remove('active');
            this.handleFileDrop(e.dataTransfer.files);
        });
    }

    handleFileDrop(files) {
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const filename = file.name;

                if (filename.endsWith('.html')) {
                    this.addFileToProject('html', filename, content);
                } else if (filename.endsWith('.css')) {
                    this.addFileToProject('css', filename, content);
                } else if (filename.endsWith('.js')) {
                    this.addFileToProject('js', filename, content);
                } else {
                    alert(`File type not supported: ${filename}`);
                }
            };
            reader.readAsText(file);
        });
    }

    addFileToProject(folderType, filename, content) {
        if (!this.currentProject) return;

        // Check if file already exists
        if (this.currentProject.files[folderType][filename]) {
            if (!confirm(`File ${filename} already exists. Overwrite?`)) {
                return;
            }
        }

        // Add to project
        this.currentProject.files[folderType][filename] = content;
        this.projectStructure[folderType] = Object.keys(this.currentProject.files[folderType]);

        // Add to openTabs
        const fileKey = `${folderType}/${filename}`;
        this.openTabs.set(fileKey, {
            folder: folderType,
            filename,
            content,
            modified: false,
            language: folderType === 'html' ? 'html' : (folderType === 'css' ? 'css' : 'javascript')
        });

        // Save to localStorage
        this.saveProjects();

        // Update UI
        this.renderProjectTree();
        this.openFile(folderType, filename);
    }

    // ===== EDITOR FUNCTIONS =====
    async loadMonacoEditor() {
        if (this.editor) return;

        return new Promise((resolve) => {
            require.config({
                paths: {
                    'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.34.1/min/vs'
                }
            });

            require(['vs/editor/editor.main'], () => {
                monaco.editor.defineTheme('vscodeTheme', {
                    base: 'vs-dark',
                    inherit: true,
                    rules: [
                        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
                        { token: 'keyword', foreground: '569CD6' },
                        { token: 'string', foreground: 'CE9178' },
                        { token: 'number', foreground: 'B5CEA8' },
                        { token: 'tag', foreground: '569CD6' },
                        { token: 'attribute.name', foreground: '9CDCFE' },
                        { token: 'attribute.value', foreground: 'CE9178' },
                        { token: 'delimiter.html', foreground: '808080' },
                        { token: 'type', foreground: '4EC9B0' },
                        { token: 'function', foreground: 'DCDCAA' }
                    ],
                    colors: {
                        'editor.background': '#0d1117',
                        'editor.foreground': '#e6edf3',
                        'editorLineNumber.foreground': '#7d8590',
                        'editorLineNumber.activeForeground': '#e6edf3',
                        'editor.selectionBackground': '#1f6feb40',
                        'editor.inactiveSelectionBackground': '#1f6feb20',
                        'editorCursor.foreground': '#e6edf3',
                        'editor.findMatchBackground': '#1f6feb60',
                        'editor.findMatchHighlightBackground': '#1f6feb30',
                        'editorWidget.background': '#161b22',
                        'editorWidget.border': '#30363d',
                        'editorSuggestWidget.background': '#161b22',
                        'editorSuggestWidget.border': '#30363d',
                        'editorSuggestWidget.selectedBackground': '#21262d'
                    }
                });

                const editorContainer = document.getElementById('monacoEditor');
                if (!editorContainer) {
                    console.error('Monaco editor container not found');
                    return;
                }

                editorContainer.innerHTML = '';

                this.editor = monaco.editor.create(editorContainer, {
                    value: '',
                    language: 'javascript',
                    theme: 'vscodeTheme',
                    fontSize: 14,
                    fontFamily: 'Consolas, "Courier New", monospace',
                    lineNumbers: 'on',
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    minimap: { enabled: true },
                    automaticLayout: true,
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    renderWhitespace: 'selection',
                    wordWrap: 'on',
                    bracketPairColorization: { enabled: true },
                    guides: {
                        bracketPairs: true,
                        indentation: true
                    },
                    scrollbar: {
                        vertical: 'auto',
                        horizontal: 'auto',
                        verticalScrollbarSize: 10,
                        horizontalScrollbarSize: 10
                    }
                });

                setTimeout(() => {
                    if (this.editor) {
                        this.editor.layout();
                    }
                }, 100);

                this.editor.onDidChangeModelContent(() => {
                    if (this.currentFile) {
                        this.saveFileContent();
                        this.updatePreview();
                    }
                });

                resolve();
            });
        });
    }

    showWelcomeScreen() {
        const editorContainer = document.getElementById('monacoEditor');
        if (!this.editor) {
            editorContainer.innerHTML = `
                <div class="closededit" style="
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    background: #0d1117;
                    color: #3a8cffff;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    font-size: 18px;
                    font-weight: 400;
                    text-align: center;
                ">
                    💾 - Select a file to start editing
                </div>
            `;
        }
    }

    renderProjectTree() {
        const projectTree = document.getElementById('projectTree');
        projectTree.innerHTML = '';

        const htmlFolder = this.createFolderElement('html', 'HTML Files', 'fas fa-code', true);
        projectTree.appendChild(htmlFolder);

        const cssFolder = this.createFolderElement('css', 'CSS Files', 'fas fa-palette', true);
        projectTree.appendChild(cssFolder);

        const jsFolder = this.createFolderElement('js', 'JS Files', 'fab fa-js', true);
        projectTree.appendChild(jsFolder);
    }

    createFolderElement(folderType, displayName, iconClass, expanded = false) {
        const folder = document.createElement('div');
        folder.className = 'folder';

        const header = document.createElement('div');
        header.className = `folder-header ${expanded ? 'expanded' : ''}`;
        header.innerHTML = `
            <i class="folder-icon ${iconClass}"></i>
            <span class="folder-name">${displayName}</span>
            <button class="add-file-btn" title="Add new file">
                <i class="fas fa-plus"></i>
            </button>
        `;

        const fileList = document.createElement('div');
        fileList.className = `file-list ${expanded ? 'expanded' : ''}`;

        this.projectStructure[folderType].forEach(filename => {
            const fileItem = this.createFileElement(folderType, filename);
            fileList.appendChild(fileItem);
        });

        header.addEventListener('click', (e) => {
            if (!e.target.closest('.add-file-btn')) {
                this.toggleFolder(header, fileList);
            }
        });

        header.querySelector('.add-file-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showCreateFileModal(folderType);
        });

        folder.appendChild(header);
        folder.appendChild(fileList);
        return folder;
    }

    createFileElement(folderType, filename) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

        const fileKey = `${folderType}/${filename}`;
        if (this.currentFile === fileKey) {
            fileItem.classList.add('active');
        }

        const iconClass = folderType === 'html' ? 'fas fa-file-code' : (folderType === 'css' ? 'fas fa-file-css' : 'fab fa-js-square');
        fileItem.innerHTML = `
            <i class="file-icon ${iconClass}"></i>
            <span class="file-name">${filename}</span>
        `;

        fileItem.addEventListener('click', () => this.openFile(folderType, filename));
        fileItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, folderType, filename);
        });

        return fileItem;
    }

    toggleFolder(header, fileList) {
        header.classList.toggle('expanded');
        fileList.classList.toggle('expanded');
    }

    openFile(folderType, filename) {
        const fileKey = `${folderType}/${filename}`;

        if (!this.openTabs.has(fileKey)) {
            const content = this.currentProject.files[folderType][filename] || '';
            this.openTabs.set(fileKey, {
                folder: folderType,
                filename,
                content,
                modified: false,
                language: folderType === 'html' ? 'html' : (folderType === 'css' ? 'css' : 'javascript')
            });
        }

        this.currentFile = fileKey;
        const fileData = this.openTabs.get(fileKey);

        if (this.editor) {
            this.editor.setModel(monaco.editor.createModel(fileData.content, fileData.language));
        }

        this.updateTabs();
        this.updatePreview();
    }

    updateTabs() {
        const tabsContainer = document.getElementById('editorTabs');
        tabsContainer.innerHTML = '';

        this.openTabs.forEach((fileData, fileKey) => {
            const tab = document.createElement('div');
            tab.className = `editor-tab ${this.currentFile === fileKey ? 'active' : ''}`;

            const iconClass = fileData.language === 'html' ? 'fas fa-file-code' : (fileData.language === 'css' ? 'fas fa-file-css' : 'fab fa-js-square');
            tab.innerHTML = `
                <i class="tab-icon ${iconClass}"></i>
                <span class="tab-name">${fileData.filename}</span>
            `;

            tab.addEventListener('click', () => this.openFile(fileData.folder, fileData.filename));
            tabsContainer.appendChild(tab);
        });
    }

    saveFileContent() {
        if (!this.currentFile || !this.editor || !this.currentProject) return;

        const [folderType, filename] = this.currentFile.split('/');
        const content = this.editor.getValue();

        this.currentProject.files[folderType][filename] = content;
        this.openTabs.get(this.currentFile).content = content;

        this.saveProjects();
    }

    updatePreview() {
        if (!this.currentProject) return;

        // Find the main HTML file (index.html or the first available HTML file)
        const htmlFiles = this.currentProject.files.html;
        const htmlFilenames = Object.keys(htmlFiles);
        if (htmlFilenames.length === 0) return;

        const mainHtmlFilename = htmlFilenames.includes('index.html') ? 'index.html' : htmlFilenames[0];
        const htmlContent = htmlFiles[mainHtmlFilename];
        const processedHtml = this.processFileLinks(htmlContent);

        const iframe = document.getElementById('previewIframe');
        // Inject CSS to hide scrollbar in iframe content
        iframe.onload = function () {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                const style = iframeDoc.createElement('style');
                style.textContent = `
            body::-webkit-scrollbar {
                display: none;
            }
            html::-webkit-scrollbar {
                display: none;
            }
            body {
                -ms-overflow-style: none;
                scrollbar-width: none;
            }
            html {
                -ms-overflow-style: none;
                scrollbar-width: none;
            }
        `;
                iframeDoc.head.appendChild(style);
            } catch (e) {
                console.log('Could not inject CSS into iframe:', e);
            }
        };

        const blob = new Blob([processedHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        iframe.src = url;

        try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            if (iframeDoc) {
                const style = document.createElement('style');
                style.textContent = `
                    ::-webkit-scrollbar {
                        width: 0px;
                        background: transparent;
                    }
                    * {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                `;
                iframeDoc.head.appendChild(style);
            }
        } catch (e) {
            console.log('Could not inject CSS into iframe:', e);
        }

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    processFileLinks(htmlContent) {
        const cssLinkRegex = /<link[^>]*href=["']\.\.\/css\/([^"']+)["'][^>]*>/gi;
        const jsScriptRegex = /<script[^>]*src=["']\.\.\/js\/([^"']+)["'][^>]*><\/script>/gi;

        let processed = htmlContent.replace(cssLinkRegex, (match, cssFilename) => {
            const cssKey = `css/${cssFilename}`;
            if (this.openTabs.has(cssKey)) {
                const cssData = this.openTabs.get(cssKey);
                return `<style>${cssData.content}</style>`;
            }
            return match;
        });

        return processed.replace(jsScriptRegex, (match, jsFilename) => {
            const jsKey = `js/${jsFilename}`;
            if (this.openTabs.has(jsKey)) {
                const jsData = this.openTabs.get(jsKey);
                return `<script>${jsData.content}</script>`;
            }
            return match;
        });
    }

    showContextMenu(event, folder, filename) {
        const contextMenu = this.contextMenu;
        contextMenu.innerHTML = `
            <div class="context-menu-item" onclick="app.renameFile('${folder}', '${filename}')">
                <i class="fas fa-edit"></i>
                Rename
            </div>
            <div class="context-menu-item" onclick="app.deleteFile('${folder}', '${filename}')">
                <i class="fas fa-trash"></i>
                Delete
            </div>
        `;

        this.positionAndShowContextMenu(event);
    }

    showProjectContextMenu(event, projectId, projectName) {
        const contextMenu = this.contextMenu;
        contextMenu.innerHTML = `
            <div class="context-menu-item" onclick="app.deleteProject('${projectId}', '${projectName}')">
                <i class="fas fa-trash"></i>
                Delete Project
            </div>
        `;

        this.positionAndShowContextMenu(event);
    }

    positionAndShowContextMenu(event) {
        const contextMenu = this.contextMenu;
        contextMenu.style.left = event.pageX + 'px';
        contextMenu.style.top = event.pageY + 'px';
        contextMenu.classList.add('show');

        const hideContextMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.classList.remove('show');
                document.removeEventListener('click', hideContextMenu);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', hideContextMenu);
        }, 100);
    }

    deleteProject(projectId, projectName) {
        if (confirm(`Are you sure you want to delete the project "${projectName}"?`)) {
            this.projects = this.projects.filter(p => p.id !== projectId);
            this.saveProjects();
            this.renderDashboard();
        }
    }

    showCreateFileModal(folderType) {
        const modal = this.modal;
        const modalHeader = document.getElementById('modalHeader');
        const modalInput = document.getElementById('modalInput');

        modalHeader.textContent = `New .${folderType.toUpperCase()} File`;
        modalInput.value = '';
        modalInput.placeholder = `file.${folderType}`;

        this.modalAction = 'create';
        this.modalContext = { folderType };

        modal.classList.add('show');
        modalInput.focus();
    }

    showRenameModal(folder, filename) {
        const modal = this.modal;
        const modalHeader = document.getElementById('modalHeader');
        const modalInput = document.getElementById('modalInput');

        modalHeader.textContent = 'Rename File';
        modalInput.value = filename;
        modalInput.placeholder = 'Enter new file name...';

        this.modalAction = 'rename';
        this.modalContext = { folder, filename };

        modal.classList.add('show');
        modalInput.focus();
        modalInput.select();
    }

    createFile(folderType, filename) {
        const expectedExt = folderType === 'html' ? '.html' : (folderType === 'css' ? '.css' : '.js');
        if (!filename.endsWith(expectedExt)) {
            filename += expectedExt;
        }

        if (this.projectStructure[folderType].includes(filename)) {
            alert('File already exists!');
            return;
        }

        const defaultContent = folderType === 'html'
            ? this.getDefaultHtmlContent(filename)
            : (folderType === 'css' ? this.getDefaultCssContent() : this.getDefaultJsContent());

        this.addFileToProject(folderType, filename, defaultContent);
    }

    renameFile(folder, oldFilename) {
        this.showRenameModal(folder, oldFilename);
    }

    deleteFile(folder, filename) {
        if (confirm(`Are you sure you want to delete ${filename}?`)) {
            if (!this.currentProject) return;

            delete this.currentProject.files[folder][filename];
            this.projectStructure[folder] = Object.keys(this.currentProject.files[folder]);

            const fileKey = `${folder}/${filename}`;
            if (this.openTabs.has(fileKey)) {
                this.openTabs.delete(fileKey);
                if (this.currentFile === fileKey) {
                    this.currentFile = null;
                    this.showWelcomeScreen();
                }
            }

            this.saveProjects();
            this.renderProjectTree();
            this.updateTabs();
        }
    }

    getDefaultHtmlContent(filename) {
        const title = filename.replace('.html', '').replace(/[-_]/g, ' ');
        return `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Default-screen</title>
    <link rel="stylesheet" href="../css/style.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Borel&display=swap" rel="stylesheet">
</head>

<body>
    <div class="container">
        <h1 class="welcome-screen">hello</h1>
    </div>
    <script src="../js/script.js"></script>

    <!-- Link notification library to app, for photo etc use input-->
    <script src="../js/notification.js"></script>
</body>

</html>`;
    }

    getDefaultCssContent() {
        return `body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    margin: 0;
    padding: 20px;
    background: linear-gradient(135deg, #002fff 0%, #cc0099 100%);
    min-height: 95.2vh;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
}
.welcome-screen{
    font-size: 2.5em;
    font-family: "Borel", cursive;
}
.welcome-screen::selection{
    background: none;
}`;
    }

    getDefaultJsContent() {
        return `document.addEventListener('DOMContentLoaded', () => {
    const title = document.querySelector('h1');
    if (title) {
        title.style.cursor = 'pointer';
        title.addEventListener('click', () => {
            alert('Welcome to setup!');
        });
    }
});

//function from notification.js lib, schedules push notification in 11 secs with message "Hello World" 
push(11, "Hello World");`;
    }

    setupEventListeners() {
        document.getElementById('modalInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.confirmModal();
            } else if (e.key === 'Escape') {
                this.closeModal();
            }
        });

        document.addEventListener('scroll', () => {
            this.contextMenu.classList.remove('show');
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        break;
                    case 'n':
                        e.preventDefault();
                        if (this.currentProject) {
                            this.showCreateFileModal('html');
                        }
                        break;
                }
            }
        });
    }

    confirmModal() {
        const modalInput = document.getElementById('modalInput');
        const filename = modalInput.value.trim();

        if (!filename) {
            alert('Please enter a file name');
            return;
        }

        if (this.modalAction === 'create') {
            this.createFile(this.modalContext.folderType, filename);
        } else if (this.modalAction === 'rename') {
            this.performRename(this.modalContext.folder, this.modalContext.filename, filename);
        }

        this.closeModal();
    }

    performRename(folder, oldFilename, newFilename) {
        if (!this.currentProject) return;
        const expectedExt = folderType === 'html' ? '.html' : (folderType === 'css' ? '.css' : '.js'); if (!newFilename.endsWith(expectedExt)) {
            newFilename += expectedExt;
        }

        if (this.currentProject.files[folder][newFilename]) {
            alert('A file with that name already exists!');
            return;
        }

        const oldKey = `${folder}/${oldFilename}`;
        const newKey = `${folder}/${newFilename}`;

        const content = this.currentProject.files[folder][oldFilename];
        delete this.currentProject.files[folder][oldFilename];
        this.currentProject.files[folder][newFilename] = content;

        if (this.openTabs.has(oldKey)) {
            const fileData = this.openTabs.get(oldKey);
            fileData.filename = newFilename;
            this.openTabs.set(newKey, fileData);
            this.openTabs.delete(oldKey);

            if (this.currentFile === oldKey) {
                this.currentFile = newKey;
            }
        }

        this.projectStructure[folder] = Object.keys(this.currentProject.files[folder]);
        this.saveProjects();
        this.renderProjectTree();
        this.updateTabs();
    }

    closeModal() {
        this.modal.classList.remove('show');
        this.modalAction = null;
        this.modalContext = null;
    }

    hideLoadingSpinner() {
        const spinner = document.getElementById('loadingSpinner');
        spinner.style.opacity = '0';
        setTimeout(() => {
            spinner.style.display = 'none';
        }, 300);
    }
}

// Global functions for context menu
function closeModal() {
    app.closeModal();
}

function confirmModal() {
    app.confirmModal();
}

// Initialize the application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new MonacoEditorApp();
});

window.addEventListener('resize', () => {
    if (app && app.editor) {
        app.editor.layout();
    }
});

window.addEventListener('load', () => {
    console.log('Monaco Loaded, ready for editing!');
    if (app && app.editor) {
        console.log('Monaco editor is available:', app.editor);
        app.editor.layout();
    }
});

const mq = window.matchMedia("(max-width: 480px)");

function checkSize(e) {
    if (e.matches) {
        alert("Site is unreachable on Phone, try Tablet or PC");
    }
}

mq.addEventListener("change", checkSize);

checkSize(mq);

let downloadbutton = document.querySelector("#download-btn");

downloadbutton.addEventListener("click", async function () {
    console.log("Downloading...");

    if (!app || !app.currentProject) {
        show("No project open!");
        return;
    }

    // Save current file before downloading
    if (app.currentFile) {
        app.saveFileContent();
    }

    runSequence();

    try {
        const backendUrl = "https://ipa-generator-backend-production.up.railway.app/generate-ipa";

        // Prepare files object: { "html/index.html": "content", ... }
        const filesToUpload = {};
        const project = app.currentProject;

        // Collect all files from the project
        Object.entries(project.files.html).forEach(([name, content]) => {
            filesToUpload[`html/${name}`] = content;
        });
        Object.entries(project.files.css).forEach(([name, content]) => {
            filesToUpload[`css/${name}`] = content;
        });
        Object.entries(project.files.js || {}).forEach(([name, content]) => {
            filesToUpload[`js/${name}`] = content;
        });

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                projectName: project.name,
                files: filesToUpload
            }),
        });

        if (!response.ok) {
            throw new Error('Backend error');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name}.ipa`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        show("Download started!");
    } catch (error) {
        console.error('Error downloading IPA:', error);
        show("Error: " + error.message);
    }
})
const notification = document.getElementById('notification');
const msg = document.getElementById('msg');
let timeout;

function show(text, duration = 2200) {
    clearTimeout(timeout);
    msg.textContent = text;
    notification.classList.remove('fade-out');
    notification.classList.add('show');

    timeout = setTimeout(hide, duration);
}

function hide() {
    notification.classList.add('fade-out');
    setTimeout(() => {
        notification.classList.remove('show', 'fade-out');
    }, 320);
}

function runSequence() {
    show("Compiling...", 1800);
    setTimeout(() => {
        hide();
        setTimeout(() => {
            show("Compiled", 5000);
        }, 400);
    }, 1800);
}
// Removed duplicate listener as it's now integrated above
