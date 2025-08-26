console.log("[GPT Comments] Extension loaded on:", window.location.hostname);

let commentButton = null;
let activeCommentBox = null;
let selectedText = '';
let selectedRange = null;
const comments = new Map();

function createCommentButton() {
    const button = document.createElement('button');
    button.id = 'gpt-comment-button';
    button.innerHTML = '💬';
    button.style.cssText = `
        position: absolute;
        display: none;
        padding: 6px 8px;
        background: white;
        color: #666;
        border: 1px solid #e5e5e5;
        border-radius: 6px;
        font-size: 18px;
        cursor: pointer;
        z-index: 10000;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        transition: all 0.2s ease;
    `;
    button.addEventListener('click', handleCommentButtonClick);
    button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.05)';
        button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    });
    button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
    });
    document.body.appendChild(button);
    return button;
}

function createCommentBox(x, y, highlightId) {
    const existingBox = document.getElementById('gpt-comment-box');
    if (existingBox) existingBox.remove();
    
    const box = document.createElement('div');
    box.id = 'gpt-comment-box';
    box.dataset.highlightId = highlightId;
    box.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: 320px;
        background: white;
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        z-index: 10001;
        animation: fadeIn 0.2s ease;
    `;
    
    const isDark = document.documentElement.classList.contains('dark') || 
                   document.querySelector('html').style.colorScheme === 'dark';
    
    if (isDark) {
        box.style.background = '#2f2f2f';
        box.style.borderColor = '#444';
        box.style.color = '#e3e3e3';
    }
    
    box.innerHTML = `
        <div style="padding: 16px;">
            <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; color: ${isDark ? '#999' : '#666'}; font-weight: 500;">Add comment</span>
                <button id="close-comment-box" style="
                    background: none;
                    border: none;
                    font-size: 20px;
                    cursor: pointer;
                    color: ${isDark ? '#999' : '#666'};
                    padding: 0;
                    line-height: 1;
                ">&times;</button>
            </div>
            <textarea id="comment-input" placeholder="Type your comment..." style="
                width: 100%;
                min-height: 80px;
                padding: 10px;
                border: 1px solid ${isDark ? '#444' : '#e5e5e5'};
                border-radius: 6px;
                font-size: 13px;
                resize: vertical;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
                background: ${isDark ? '#212121' : 'white'};
                color: ${isDark ? '#e3e3e3' : '#333'};
            "></textarea>
            <div style="display: flex; gap: 8px; margin-top: 10px; justify-content: flex-end;">
                <button id="cancel-comment" style="
                    padding: 6px 12px;
                    background: ${isDark ? '#444' : '#f0f0f0'};
                    color: ${isDark ? '#e3e3e3' : '#666'};
                    border: none;
                    border-radius: 4px;
                    font-size: 13px;
                    cursor: pointer;
                ">Cancel</button>
                <button id="submit-comment" style="
                    padding: 6px 12px;
                    background: #10a37f;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                ">Comment</button>
            </div>
        </div>
        <div id="existing-comments" style="
            max-height: 200px;
            overflow-y: auto;
            border-top: 1px solid ${isDark ? '#444' : '#e5e5e5'};
            display: none;
        "></div>
    `;
    
    document.body.appendChild(box);
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
    
    document.getElementById('close-comment-box').addEventListener('click', () => cancelComment(highlightId));
    document.getElementById('cancel-comment').addEventListener('click', () => cancelComment(highlightId));
    document.getElementById('submit-comment').addEventListener('click', () => submitComment(highlightId));
    document.getElementById('comment-input').focus();
    
    const existingComments = comments.get(highlightId);
    if (existingComments && existingComments.length > 0) {
        displayExistingComments(highlightId);
    }
    
    return box;
}

function findContentRightBoundary() {
    // Try to find ChatGPT's main content container
    const selectors = [
        '[data-testid="conversation-turn-"]', // ChatGPT message containers
        '.prose', // Common prose container
        'article', // Article containers
        '[role="main"]', // Main content area
        '.max-w-3xl', // Common max-width container
        '.max-w-4xl', // Alternative max-width container
        '.mx-auto' // Centered container
    ];
    
    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            // Find the widest element that likely contains our content
            let maxRight = 0;
            for (const el of elements) {
                const rect = el.getBoundingClientRect();
                if (rect.right > maxRight && rect.width > 300) { // Minimum width check
                    maxRight = rect.right;
                }
            }
            if (maxRight > 0) {
                return maxRight + window.scrollX;
            }
        }
    }
    
    // Fallback: use viewport-based positioning
    const viewportWidth = window.innerWidth;
    if (viewportWidth > 1200) {
        // Large screens: position at 70% of viewport width
        return viewportWidth * 0.7;
    } else if (viewportWidth > 768) {
        // Medium screens: position at 80% of viewport width
        return viewportWidth * 0.8;
    } else {
        // Small screens: position at 90% of viewport width
        return viewportWidth * 0.9;
    }
}


function handleTextSelection() {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text && text.length > 0) {
        selectedText = text;
        selectedRange = selection.getRangeAt(0);
        
        const range = selectedRange;
        const rect = range.getBoundingClientRect();
        const rightBoundary = findContentRightBoundary();
        
        commentButton.style.display = 'block';
        commentButton.style.left = `${rightBoundary + 10}px`;
        commentButton.style.top = `${rect.top + window.scrollY}px`;
    } else {
        if (commentButton) {
            commentButton.style.display = 'none';
        }
    }
}

function handleCommentButtonClick(e) {
    e.stopPropagation();
    
    const highlightId = addHighlight(selectedRange);
    if (!highlightId) return;
    
    // Position comment box at the right edge, same as button
    const buttonRect = commentButton.getBoundingClientRect();
    const boxWidth = 320;
    
    // Start with positioning at button location
    let x = buttonRect.left + window.scrollX;
    const y = buttonRect.bottom + window.scrollY + 5;
    
    // If the button is too far right, position the box to its left
    if (buttonRect.left > window.innerWidth - boxWidth - 20) {
        x = buttonRect.right + window.scrollX - boxWidth; // Align right edges
    }
    
    createCommentBox(x, y, highlightId);
    commentButton.style.display = 'none';
    window.getSelection().removeAllRanges();
}

function addHighlight(range) {
    if (!range) return null;
    
    const highlightId = 'highlight-' + Date.now();
    
    try {
        // Extract and wrap contents manually to handle complex selections
        const contents = range.extractContents();
        const highlight = document.createElement('span');
        highlight.className = 'gpt-comment-highlight';
        highlight.dataset.highlightId = highlightId;
        highlight.style.cssText = `
            background-color: rgba(255, 212, 0, 0.3);
            cursor: pointer;
            position: relative;
            border-bottom: 2px solid rgba(255, 193, 7, 0.5);
            display: inline;
        `;
        
        // Move all extracted nodes into the highlight span
        while (contents.firstChild) {
            highlight.appendChild(contents.firstChild);
        }
        
        // Insert the highlight span back into the document
        range.insertNode(highlight);
        
        // Add click handler
        highlight.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = highlight.getBoundingClientRect();
            const rightBoundary = findContentRightBoundary();
            const x = Math.min(rightBoundary - 320, rect.left + window.scrollX);
            const y = rect.bottom + window.scrollY + 10;
            createCommentBox(x, y, highlightId);
        });
        
        // Add comment indicator
        const commentIndicator = document.createElement('span');
        commentIndicator.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            width: 16px;
            height: 16px;
            background: #ffc107;
            border-radius: 50%;
            display: none;
            font-size: 10px;
            color: white;
            text-align: center;
            line-height: 16px;
            font-weight: bold;
            pointer-events: none;
        `;
        commentIndicator.className = 'comment-indicator';
        highlight.appendChild(commentIndicator);
        
        // Ensure the highlight is properly positioned
        highlight.style.position = 'relative';
        
        return highlightId;
    } catch (e) {
        console.log('[GPT Comments] Error highlighting text:', e);
        
        // Fallback: try a simpler approach for single text nodes
        try {
            const selectedText = range.toString();
            const startContainer = range.startContainer;
            const startOffset = range.startOffset;
            const endOffset = range.endOffset;
            
            if (startContainer.nodeType === Node.TEXT_NODE && 
                range.startContainer === range.endContainer) {
                // Simple case: selection within a single text node
                const textNode = startContainer;
                const beforeText = textNode.textContent.substring(0, startOffset);
                const selectedPart = textNode.textContent.substring(startOffset, endOffset);
                const afterText = textNode.textContent.substring(endOffset);
                
                const highlight = document.createElement('span');
                highlight.className = 'gpt-comment-highlight';
                highlight.dataset.highlightId = highlightId;
                highlight.style.cssText = `
                    background-color: rgba(255, 212, 0, 0.3);
                    cursor: pointer;
                    position: relative;
                    border-bottom: 2px solid rgba(255, 193, 7, 0.5);
                `;
                highlight.textContent = selectedPart;
                
                const parent = textNode.parentNode;
                const beforeNode = document.createTextNode(beforeText);
                const afterNode = document.createTextNode(afterText);
                
                parent.insertBefore(beforeNode, textNode);
                parent.insertBefore(highlight, textNode);
                parent.insertBefore(afterNode, textNode);
                parent.removeChild(textNode);
                
                // Add click handler
                highlight.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const rect = highlight.getBoundingClientRect();
                    const rightBoundary = findContentRightBoundary();
                    const x = Math.min(rightBoundary - 320, rect.left + window.scrollX);
                    const y = rect.bottom + window.scrollY + 10;
                    createCommentBox(x, y, highlightId);
                });
                
                // Add comment indicator
                const commentIndicator = document.createElement('span');
                commentIndicator.style.cssText = `
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    width: 16px;
                    height: 16px;
                    background: #ffc107;
                    border-radius: 50%;
                    display: none;
                    font-size: 10px;
                    color: white;
                    text-align: center;
                    line-height: 16px;
                    font-weight: bold;
                    pointer-events: none;
                `;
                commentIndicator.className = 'comment-indicator';
                highlight.appendChild(commentIndicator);
                
                return highlightId;
            }
        } catch (fallbackError) {
            console.log('[GPT Comments] Fallback also failed:', fallbackError);
        }
        
        return null;
    }
}

function submitComment(highlightId) {
    const commentText = document.getElementById('comment-input').value.trim();
    if (!commentText) return;
    
    const comment = {
        id: Date.now(),
        text: commentText,
        highlightId: highlightId,
        timestamp: new Date().toISOString(),
        url: window.location.href
    };
    
    if (!comments.has(highlightId)) {
        comments.set(highlightId, []);
    }
    comments.get(highlightId).push(comment);
    
    updateLocalStorage();
    
    updateCommentIndicator(highlightId);
    displayExistingComments(highlightId);
    
    document.getElementById('comment-input').value = '';
    console.log('[GPT Comments] Comment saved:', comment);
}

function updateCommentIndicator(highlightId) {
    const highlight = document.querySelector(`[data-highlight-id="${highlightId}"]`);
    if (!highlight) return;
    
    const indicator = highlight.querySelector('.comment-indicator');
    const commentCount = comments.get(highlightId)?.length || 0;
    
    if (indicator && commentCount > 0) {
        indicator.style.display = 'block';
        indicator.textContent = commentCount;
    }
}

function displayExistingComments(highlightId) {
    const container = document.getElementById('existing-comments');
    const commentList = comments.get(highlightId) || [];
    
    if (commentList.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    container.innerHTML = '';
    
    const isDark = document.documentElement.classList.contains('dark') || 
                   document.querySelector('html').style.colorScheme === 'dark';
    
    commentList.forEach(comment => {
        const date = new Date(comment.timestamp);
        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const commentDiv = document.createElement('div');
        commentDiv.style.cssText = `
            padding: 12px 16px;
            border-bottom: 1px solid ${isDark ? '#444' : '#f0f0f0'};
        `;
        
        commentDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <div style="font-size: 11px; color: ${isDark ? '#999' : '#999'};">${timeString}</div>
                <button class="delete-comment-btn" data-comment-id="${comment.id}" data-highlight-id="${highlightId}" style="
                    background: none;
                    border: none;
                    color: ${isDark ? '#999' : '#999'};
                    cursor: pointer;
                    font-size: 14px;
                    padding: 2px 4px;
                    border-radius: 3px;
                    transition: all 0.2s ease;
                " onmouseover="this.style.background='${isDark ? '#444' : '#f0f0f0'}'; this.style.color='${isDark ? '#ff6b6b' : '#e74c3c'}'" onmouseout="this.style.background='none'; this.style.color='${isDark ? '#999' : '#999'}'">×</button>
            </div>
            <div style="font-size: 13px; color: ${isDark ? '#e3e3e3' : '#333'}; line-height: 1.4;">${comment.text}</div>
        `;
        
        container.appendChild(commentDiv);
    });
    
    // Add event listeners for delete buttons
    container.querySelectorAll('.delete-comment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const commentId = parseInt(e.target.dataset.commentId);
            const highlightId = e.target.dataset.highlightId;
            deleteComment(commentId, highlightId);
        });
    });
}

function cancelComment(highlightId) {
    // Check if there are any existing comments for this highlight
    const existingComments = comments.get(highlightId);
    
    if (!existingComments || existingComments.length === 0) {
        // No comments exist, remove the highlight
        removeHighlight(highlightId);
    }
    
    // Remove the comment box
    const box = document.getElementById('gpt-comment-box');
    if (box) box.remove();
}

function deleteComment(commentId, highlightId) {
    const commentList = comments.get(highlightId);
    if (!commentList) return;
    
    // Remove the comment from the array
    const updatedComments = commentList.filter(comment => comment.id !== commentId);
    
    if (updatedComments.length === 0) {
        // No comments left, remove the highlight and the entry from comments map
        comments.delete(highlightId);
        removeHighlight(highlightId);
    } else {
        // Update the comments for this highlight
        comments.set(highlightId, updatedComments);
        updateCommentIndicator(highlightId);
    }
    
    // Update localStorage
    updateLocalStorage();
    
    // Refresh the comments display
    displayExistingComments(highlightId);
    
    // If no comments left, close the comment box
    if (updatedComments.length === 0) {
        const box = document.getElementById('gpt-comment-box');
        if (box) box.remove();
    }
}

function removeHighlight(highlightId) {
    const highlight = document.querySelector(`[data-highlight-id="${highlightId}"]`);
    if (!highlight) return;
    
    // Get all text content from the highlight
    const textContent = highlight.textContent;
    
    // Create a text node with the original content
    const textNode = document.createTextNode(textContent);
    
    // Replace the highlight with the plain text
    highlight.parentNode.replaceChild(textNode, highlight);
}

function updateLocalStorage() {
    const allComments = [];
    comments.forEach((commentList, hId) => {
        commentList.forEach(c => allComments.push({...c, highlightId: hId}));
    });
    localStorage.setItem('gpt-comments', JSON.stringify(allComments));
}

function loadStoredComments() {
    const stored = localStorage.getItem('gpt-comments');
    if (!stored) return;
    
    try {
        const allComments = JSON.parse(stored);
        allComments.forEach(comment => {
            if (!comments.has(comment.highlightId)) {
                comments.set(comment.highlightId, []);
            }
            comments.get(comment.highlightId).push(comment);
        });
        
        comments.forEach((_, highlightId) => {
            updateCommentIndicator(highlightId);
        });
    } catch (e) {
        console.error('[GPT Comments] Error loading comments:', e);
    }
}

function initialize() {
    console.log('[GPT Comments] Initializing UI components');
    
    commentButton = createCommentButton();
    loadStoredComments();
    
    document.addEventListener('mouseup', () => {
        setTimeout(handleTextSelection, 10);
    });
    
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#gpt-comment-button') && 
            !e.target.closest('#gpt-comment-box') &&
            !e.target.closest('.gpt-comment-highlight')) {
            if (commentButton && commentButton.style.display === 'block') {
                const selection = window.getSelection();
                if (!selection.toString().trim()) {
                    commentButton.style.display = 'none';
                }
            }
            const box = document.getElementById('gpt-comment-box');
            if (box && !e.target.closest('#gpt-comment-box')) {
                const highlightId = box.dataset.highlightId;
                if (highlightId) {
                    cancelComment(highlightId);
                } else {
                    box.remove();
                }
            }
        }
    });
    
    // Handle window resize to reposition comment button
    window.addEventListener('resize', () => {
        if (commentButton && commentButton.style.display === 'block' && selectedRange) {
            const rect = selectedRange.getBoundingClientRect();
            const rightBoundary = findContentRightBoundary();
            commentButton.style.left = `${rightBoundary + 10}px`;
            commentButton.style.top = `${rect.top + window.scrollY}px`;
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
}