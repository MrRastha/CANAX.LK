// CANAX Chatbot - Main Script
class CANAXChatbot {
    constructor() {
        this.apiKey = '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';
        this.model = localStorage.getItem('model_id') || 'openai/gpt-oss-120b:free';
        this.conversations = [];
        this.currentConversationId = this.generateId();
        this.isLoading = false;

        this.initializeElements();
        this.attachEventListeners();
        this.loadConversation();
    }

    // Generate unique ID for conversations
    generateId() {
        return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Initialize DOM elements
    initializeElements() {
        this.chatContainer = document.getElementById('chatContainer');
        this.messageInput = document.getElementById('messageInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.mobileMenuBtn = document.getElementById('mobileMenuBtn');
        this.sidebar = document.getElementById('sidebar');
        this.fileInput = document.getElementById('fileInput');
        this.imageUploadBtn = document.getElementById('imageUploadBtn');
        this.imageDropZone = document.getElementById('imageDropZone');
        this.imagePreview = document.getElementById('imagePreview');
        this.previewImg = document.getElementById('previewImg');
        this.removeImageBtn = document.getElementById('removeImageBtn');
        this.selectedImage = null;
    }

    // Attach event listeners
    attachEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.fileInput.addEventListener('change', (e) => this.handleImageSelect(e));
        this.removeImageBtn.addEventListener('click', () => this.removeImage());

        // Drag-and-drop for images
        this.imageDropZone.addEventListener('click', () => this.fileInput.click());
        this.imageDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.imageDropZone.classList.add('border-cyan-400', 'text-white', 'bg-slate-700');
        });
        this.imageDropZone.addEventListener('dragleave', () => {
            this.imageDropZone.classList.remove('border-cyan-400', 'text-white', 'bg-slate-700');
        });
        this.imageDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.imageDropZone.classList.remove('border-cyan-400', 'text-white', 'bg-slate-700');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                this.fileInput.files = e.dataTransfer.files;
                this.handleImageSelect({ target: { files: e.dataTransfer.files } });
            } else {
                alert('Please drop an image file.');
            }
        });

        // Mobile menu button
        this.mobileMenuBtn.addEventListener('click', () => this.toggleMobileMenu());
    }

    // Check if API Key exists
    checkApiKey() {
        if (!this.apiKey) {
            this.showWelcomeMessage();
        }
    }

    // Handle image selection
    handleImageSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.selectedImage = e.target.result;
            this.previewImg.src = this.selectedImage;
            this.imagePreview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }

    // Remove selected image
    removeImage() {
        this.selectedImage = null;
        this.imagePreview.classList.add('hidden');
        this.fileInput.value = '';
    }

    // Show welcome message with API key prompt
    showWelcomeMessage() {
        const welcomeClass = 'message-enter';
        this.chatContainer.innerHTML = `
            <div class="flex justify-center items-center h-full">
                <div class="text-center max-w-md welcome-content">
                    <div class="mb-4 text-6xl">🤖</div>
                    <h2 class="text-3xl font-bold mb-4">Welcome to CANAX</h2>
                    <p class="text-slate-400">Your AI-powered conversation assistant. Start typing to begin chatting!</p>
                </div>
            </div>
        `;
    }

    // Toggle mobile menu
    toggleMobileMenu() {
        this.sidebar.classList.toggle('open');
    }

    // Send message to API
    async sendMessage() {
        const message = this.messageInput.value.trim();

        if (!message && !this.selectedImage) return;

        // Add user message to UI
        this.addMessageToUI(message, 'user', this.selectedImage);
        this.messageInput.value = '';
        this.sendBtn.disabled = true;
        this.isLoading = true;

        // Add to conversation history
        const currentConv = this.getConversation(this.currentConversationId);
        currentConv.messages.push({ 
            role: 'user', 
            content: message,
            image: this.selectedImage
        });

        // Show typing indicator
        this.showTypingIndicator();

        try {
            const response = await this.callOpenRouterAPI(message, this.selectedImage);
            this.removeTypingIndicator();
            
            if (response) {
                this.addMessageToUI(response, 'assistant');
                currentConv.messages.push({ role: 'assistant', content: response });
            }
        } catch (error) {
            this.removeTypingIndicator();
            console.error('Error:', error);

            // Handle specific API errors
            let errorMessage = error.message;
            if (error.message.includes('User not found')) {
                errorMessage = 'API key is invalid or expired. Please contact support to update the API key.';
            } else if (error.message.includes('quota') || error.message.includes('rate limit')) {
                errorMessage = 'API quota exceeded. Please try again later.';
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                errorMessage = 'Network error. Please check your internet connection.';
            }

            this.addMessageToUI(`❌ ${errorMessage}`, 'error');
        } finally {
            this.removeImage();
            this.sendBtn.disabled = false;
            this.isLoading = false;
        }
    }

    // Call OpenRouter API
    async callOpenRouterAPI(userMessage, image) {
        const currentConv = this.getConversation(this.currentConversationId);
        const messages = currentConv.messages.map(msg => {
            if (msg.image) {
                // Message with image - use vision format
                return {
                    role: msg.role,
                    content: [
                        {
                            type: 'text',
                            text: msg.content || 'Analyze this image'
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: msg.image
                            }
                        }
                    ]
                };
            } else {
                // Regular text message
                return {
                    role: msg.role,
                    content: msg.content
                };
            }
        });

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'CANAX Chatbot',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 1000,
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'API request failed');
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || 'No response received';
    }

    // Add message to UI
    addMessageToUI(content, role, image = null) {
        if (this.chatContainer.innerHTML.includes('Welcome to CANAX') || 
            this.chatContainer.innerHTML.includes('Your AI-powered conversation')) {
            this.chatContainer.innerHTML = '';
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message-enter ${role}-message`;

        const contentDiv = document.createElement('div');
        contentDiv.className = `${role}-message-content`;

        // Add image if present
        if (image) {
            const imgElement = document.createElement('img');
            imgElement.src = image;
            imgElement.className = 'message-image';
            imgElement.style.maxWidth = '300px';
            contentDiv.appendChild(imgElement);
        }

        // Add text content
        if (content) {
            const textDiv = document.createElement('div');
            textDiv.innerHTML = this.formatMessage(content);
            contentDiv.appendChild(textDiv);
        }

        messageDiv.appendChild(contentDiv);
        this.chatContainer.appendChild(messageDiv);

        // Scroll to bottom
        setTimeout(() => {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }, 0);
    }

    // Format message with markdown support
    formatMessage(content) {
        if (content.includes('Error:')) {
            return `<span class="text-red-300">${this.escapeHtml(content)}</span>`;
        }

        // Escape HTML first
        let formatted = this.escapeHtml(content);

        // Bold (**text**)
        formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Italic (*text*)
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Code blocks (```code```)
        formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

        // Inline code (`code`)
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Line breaks
        formatted = formatted.replace(/\n/g, '<br>');

        return formatted;
    }

    // Escape HTML
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // Show typing indicator
    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'assistant-message typing-container message-enter';
        typingDiv.innerHTML = `
            <div class="assistant-message-content">
                <div class="typing-indicator">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </div>
            </div>
        `;
        this.chatContainer.appendChild(typingDiv);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    // Remove typing indicator
    removeTypingIndicator() {
        const typingContainer = document.querySelector('.typing-container');
        if (typingContainer) {
            typingContainer.remove();
        }
    }

    // New conversation
    newConversation() {
        this.currentConversationId = this.generateId();
        
        const newConv = {
            id: this.currentConversationId,
            title: 'New Chat',
            messages: [],
            timestamp: new Date().toISOString()
        };
        this.conversations.push(newConv);

        this.chatContainer.innerHTML = `
            <div class="flex justify-center items-center h-full">
                <div class="text-center max-w-md">
                    <div class="mb-4 text-6xl">💬</div>
                    <h2 class="text-3xl font-bold mb-2">New Chat</h2>
                    <p class="text-slate-400">Start typing to begin a new conversation...</p>
                </div>
            </div>
        `;
    }

    // Get conversation by ID
    getConversation(id) {
        let conv = this.conversations.find(c => c.id === id);
        if (!conv) {
            conv = {
                id: id,
                title: 'New Chat',
                messages: [],
                timestamp: new Date().toISOString()
            };
            this.conversations.push(conv);
        }
        return conv;
    }

    // Load conversation
    loadConversation() {
        const conv = this.getConversation(this.currentConversationId);
        
        if (conv.messages.length === 0) {
            this.chatContainer.innerHTML = `
                <div class="flex justify-center items-center h-full">
                    <div class="text-center max-w-md">
                        <div class="mb-4 text-6xl">💬</div>
                        <h2 class="text-3xl font-bold mb-2">Welcome to CANAX</h2>
                        <p class="text-slate-400">Start typing to begin chatting!</p>
                    </div>
                </div>
            `;
        } else {
            this.chatContainer.innerHTML = '';
            conv.messages.forEach(msg => {
                this.addMessageToUI(msg.content, msg.role === 'user' ? 'user' : 'assistant', msg.image || null);
            });
        }
    }


}

// Initialize chatbot when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const chatbot = new CANAXChatbot();
});
