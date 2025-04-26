/**
 * Document Uploader Component
 * Handles uploading and ingestion of PDF documents
 */
import DOM from '../utils/dom.js';
import API from '../utils/api.js';
import Config from '../config.js';

const Uploader = {
    elements: {
        uploadForm: null,
        fileInput: null,
        createPerPdf: null,
        ingestStatusDiv: null,
        dropZone: null,
        dropZonePrompt: null
    },

    /**
     * Initialize the uploader component
     */
    init() {
        // Cache DOM elements
        this.elements = {
            uploadForm: DOM.getById('upload-form'),
            fileInput: DOM.getById('file-input'),
            createPerPdf: DOM.getById('create-per-pdf'),
            ingestStatusDiv: DOM.getById('ingest-status'),
            dropZone: DOM.getById('drop-zone')
        };

        if (this.elements.dropZone) {
            this.elements.dropZonePrompt = this.elements.dropZone.querySelector('.drop-zone-prompt');
        }

        // Initialize event handlers
        this._initDropZone();
        this._initFileInput();
        this._initUploadForm();
    },

    /**
     * Initialize the drag and drop functionality
     * @private
     */
    _initDropZone() {
        const dropZone = this.elements.dropZone;
        if (!dropZone) return;

        // Prevent default behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        // Add visual cues during drag
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drop-zone-active');
            }, false);
        });

        // Remove visual cues when drag ends
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drop-zone-active');
            }, false);
        });

        // Handle file drop
        dropZone.addEventListener('drop', (e) => {
            if (e.dataTransfer.files && this.elements.fileInput) {
                this.elements.fileInput.files = e.dataTransfer.files;
                this._updateFileCounter();
            }
        });
    },

    /**
     * Initialize file input change handler
     * @private
     */
    _initFileInput() {
        if (!this.elements.fileInput) return;
        
        this.elements.fileInput.addEventListener('change', () => {
            this._updateFileCounter();
        });
    },

    /**
     * Initialize upload form submission handler
     * @private
     */
    _initUploadForm() {
        if (!this.elements.uploadForm || !this.elements.fileInput || !this.elements.ingestStatusDiv) return;
        
        this.elements.uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Validate file selection
            if (this.elements.fileInput.files.length === 0) {
                DOM.showStatus(
                    this.elements.ingestStatusDiv, 
                    "Please select at least one PDF file.", 
                    'error'
                );
                return;
            }

            DOM.showStatus(this.elements.ingestStatusDiv, "Processing documents...", 'info');
            
            const submitButton = this.elements.uploadForm.querySelector('button[type="submit"]');
            if (submitButton) submitButton.disabled = true;

            try {
                const formData = new FormData();
                
                // Add all selected files to form data
                for (const file of this.elements.fileInput.files) {
                    formData.append('pdfs', file);
                }
                
                // Add option to create separate collection per PDF if checked
                if (this.elements.createPerPdf) {
                    formData.append('perPdf', this.elements.createPerPdf.checked);
                }

                const response = await API.upload(Config.api.ingest, formData);

                DOM.showStatus(
                    this.elements.ingestStatusDiv, 
                    `Success: ${response.message || 'Documents processed.'}`, 
                    'success',
                    5000
                );
                
                // Reset form after successful upload
                this._resetDropZone();
            } catch (error) {
                console.error("Ingest error:", error);
                
                DOM.showStatus(
                    this.elements.ingestStatusDiv, 
                    `Error: ${error.message || 'Failed to process documents.'}`, 
                    'error'
                );
            } finally {
                if (submitButton) submitButton.disabled = false;
            }
        });
    },

    /**
     * Update the file counter display
     * @private
     */
    _updateFileCounter() {
        const { fileInput, dropZonePrompt } = this.elements;
        if (!fileInput || !dropZonePrompt) return;
        
        const fileCount = fileInput.files.length;
        
        if (fileCount > 0) {
            dropZonePrompt.textContent = `${fileCount} ${fileCount === 1 ? 'file selected' : 'files selected'}`;
        } else {
            dropZonePrompt.innerHTML = 'Drag PDF files here or <strong>click to select</strong>';
        }
    },

    /**
     * Reset the drop zone and form
     * @private
     */
    _resetDropZone() {
        if (this.elements.uploadForm) {
            this.elements.uploadForm.reset();
        }
        
        if (this.elements.fileInput) {
            this.elements.fileInput.value = '';
        }
        
        this._updateFileCounter();
    }
};

export default Uploader;