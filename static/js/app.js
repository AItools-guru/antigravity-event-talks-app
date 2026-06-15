/**
 * Frontend Application Script - BigQuery Release Notes Dashboard
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const btnRefresh = document.getElementById('btn-refresh');
    const iconSync = btnRefresh.querySelector('.icon-sync');
    const feedCount = document.getElementById('feed-count');
    const loadingContainer = document.getElementById('loading-container');
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    const btnRetry = document.getElementById('btn-retry');
    const feedContainer = document.getElementById('feed-container');
    
    const composerEmpty = document.getElementById('composer-empty');
    const composerActive = document.getElementById('composer-active');
    const previewDate = document.getElementById('preview-date');
    const previewType = document.getElementById('preview-type');
    const previewBody = document.getElementById('preview-body');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCount = document.getElementById('char-count');
    const btnTweet = document.getElementById('btn-tweet');
    const toast = document.getElementById('toast');

    // State
    let releaseNotes = [];
    let selectedUpdate = null; // { date, type, html, text, link }

    // Init
    fetchReleaseNotes();

    // Event Listeners
    btnRefresh.addEventListener('click', fetchReleaseNotes);
    btnRetry.addEventListener('click', fetchReleaseNotes);
    tweetTextarea.addEventListener('input', handleTweetInput);
    btnTweet.addEventListener('click', postTweet);

    /**
     * Fetch Release Notes from backend
     */
    async function fetchReleaseNotes() {
        setLoadingState(true);
        try {
            const response = await fetch('/api/release-notes');
            const data = await response.json();
            
            if (data.success) {
                releaseNotes = data.entries;
                renderFeed();
                showToast('Feed refreshed successfully!', 'success');
            } else {
                throw new Error(data.error || 'Failed to fetch release notes.');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            showErrorState(error.message);
            showToast('Failed to refresh feed.', 'error');
        } finally {
            setLoadingState(false);
        }
    }

    /**
     * Toggle UI Loading states
     */
    function setLoadingState(isLoading) {
        if (isLoading) {
            iconSync.classList.add('loading');
            btnRefresh.disabled = true;
            loadingContainer.classList.remove('hidden');
            feedContainer.classList.add('hidden');
            errorContainer.classList.add('hidden');
        } else {
            iconSync.classList.remove('loading');
            btnRefresh.disabled = false;
            loadingContainer.classList.add('hidden');
        }
    }

    /**
     * Display error block
     */
    function showErrorState(message) {
        feedCount.textContent = 'Error';
        errorMessage.textContent = message;
        errorContainer.classList.remove('hidden');
        feedContainer.classList.add('hidden');
    }

    /**
     * Parse the day's updates from the raw HTML content block
     * XML contains multiple <h3> tags (e.g. Feature, Change) followed by paragraphs
     */
    function parseUpdates(dateTitle, htmlContent, entryLink) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const updates = [];
        
        let currentType = '';
        let currentNodes = [];
        
        Array.from(doc.body.children).forEach(child => {
            if (child.tagName === 'H3') {
                // Save previous group if it exists
                if (currentType) {
                    updates.push(createUpdateObject(dateTitle, currentType, currentNodes, entryLink));
                }
                currentType = child.textContent.trim();
                currentNodes = [];
            } else {
                currentNodes.push(child);
            }
        });
        
        // Save final group
        if (currentType) {
            updates.push(createUpdateObject(dateTitle, currentType, currentNodes, entryLink));
        }
        
        // Fallback: if no <h3> tags were found, treat whole content as one update
        if (updates.length === 0 && htmlContent.trim() !== '') {
            updates.push(createUpdateObject(dateTitle, 'Update', Array.from(doc.body.children), entryLink));
        }
        
        return updates;
    }

    /**
     * Helper to package parsed update nodes into a standard object
     */
    function createUpdateObject(date, type, nodes, link) {
        const tempDiv = document.createElement('div');
        nodes.forEach(node => tempDiv.appendChild(node.cloneNode(true)));
        
        return {
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15),
            date: date,
            type: type,
            html: tempDiv.innerHTML,
            text: tempDiv.textContent.replace(/\s+/g, ' ').trim(),
            link: link
        };
    }

    /**
     * Render the list of release notes grouping by date
     */
    function renderFeed() {
        feedContainer.innerHTML = '';
        let totalUpdates = 0;
        
        if (releaseNotes.length === 0) {
            feedContainer.innerHTML = `
                <div class="composer-empty" style="border: none; padding: 2rem;">
                    <h3>No release notes found</h3>
                    <p>The BigQuery release feed is currently empty.</p>
                </div>
            `;
            feedCount.textContent = '0';
            feedContainer.classList.remove('hidden');
            return;
        }

        releaseNotes.forEach(entry => {
            const parsedItems = parseUpdates(entry.title, entry.content, entry.link);
            if (parsedItems.length === 0) return;
            
            totalUpdates += parsedItems.length;

            // Create Date Group Container
            const dateGroup = document.createElement('div');
            dateGroup.className = 'date-group';
            
            // Group Header
            const dateHeader = document.createElement('div');
            dateHeader.className = 'date-group-header';
            dateHeader.innerHTML = `
                <span class="date-text">${entry.title}</span>
                <span class="items-count">${parsedItems.length} update${parsedItems.length > 1 ? 's' : ''}</span>
            `;
            dateGroup.appendChild(dateHeader);

            // Group Cards
            parsedItems.forEach(item => {
                const card = document.createElement('div');
                card.className = 'update-card';
                card.dataset.id = item.id;
                
                // Add active highlight if it matches currently selected
                if (selectedUpdate && selectedUpdate.id === item.id) {
                    card.classList.add('selected');
                }
                
                const typeClass = item.type.toLowerCase();
                const safeTypeClass = ['feature', 'change', 'deprecation', 'fix'].includes(typeClass) ? typeClass : 'unknown';

                card.innerHTML = `
                    <div class="update-card-header">
                        <span class="type-pill ${safeTypeClass}">${item.type}</span>
                        <span class="select-hint">
                            <span>Select to Tweet</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                            </svg>
                        </span>
                    </div>
                    <div class="update-body">${item.html}</div>
                `;

                // Card Click Selection
                card.addEventListener('click', () => selectUpdateCard(item, card));
                dateGroup.appendChild(card);
            });

            feedContainer.appendChild(dateGroup);
        });

        feedCount.textContent = totalUpdates;
        feedContainer.classList.remove('hidden');
    }

    /**
     * Select update card and load into Composer
     */
    function selectUpdateCard(item, cardElement) {
        // Deselect previous
        document.querySelectorAll('.update-card').forEach(el => el.classList.remove('selected'));
        
        // Toggle/Select current
        selectedUpdate = item;
        cardElement.classList.add('selected');

        // Populate Composer
        previewDate.textContent = item.date;
        previewType.textContent = item.type;
        
        const typeClass = item.type.toLowerCase();
        const safeTypeClass = ['feature', 'change', 'deprecation', 'fix'].includes(typeClass) ? typeClass : 'unknown';
        previewType.className = `type-pill ${safeTypeClass}`;
        
        previewBody.innerHTML = item.html;

        // Auto-generate clean Tweet text
        const generatedText = generateTweetText(item);
        tweetTextarea.value = generatedText;
        
        // Trigger character counter
        handleTweetInput();

        // Reveal composer editor
        composerEmpty.classList.add('hidden');
        composerActive.classList.remove('hidden');
        
        // Scroll composer into view on mobile
        if (window.innerWidth <= 968) {
            composerActive.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    /**
     * Auto-generate tweet text with smart truncation for limits (280 chars)
     */
    function generateTweetText(item) {
        const header = `Google Cloud BigQuery Update (${item.date})\n\n`;
        const footer = `\n\n#BigQuery #GoogleCloud`;
        const link = item.link ? `\nSource: ${item.link}` : '';
        
        // Calculate remaining length for the description
        const constantLength = header.length + footer.length + link.length;
        const maxDescLength = 280 - constantLength - 5; // offset buffer
        
        let desc = item.text;
        
        // Clean up text double spaces or trailing periods if needed
        if (desc.length > maxDescLength) {
            desc = desc.substring(0, maxDescLength) + '...';
        }
        
        return `${header}🔹 [${item.type}] ${desc}${link}${footer}`;
    }

    /**
     * Update character counts and colors
     */
    function handleTweetInput() {
        const text = tweetTextarea.value;
        const len = text.length;
        charCount.textContent = len;

        // Apply class colors based on limit
        charCount.className = '';
        if (len > 280) {
            charCount.classList.add('error');
            btnTweet.disabled = true;
        } else if (len > 250) {
            charCount.classList.add('warning');
            btnTweet.disabled = false;
        } else {
            btnTweet.disabled = false;
        }
    }

    /**
     * Open Twitter/X intent window
     */
    function postTweet() {
        if (!selectedUpdate) return;
        
        const tweetText = tweetTextarea.value;
        if (tweetText.length > 280) {
            showToast('Tweet text exceeds 280 characters!', 'error');
            return;
        }

        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(twitterIntentUrl, '_blank', 'width=550,height=420,toolbar=0,status=0');
        showToast('Redirected to Twitter/X compose window!', 'success');
    }

    /**
     * Show Toast notifications
     */
    let toastTimeout;
    function showToast(message, type = 'success') {
        clearTimeout(toastTimeout);
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span>${message}</span>
        `;
        toast.classList.remove('hidden');

        toastTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
});
