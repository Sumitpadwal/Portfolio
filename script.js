let menuIcon = document.querySelector('#menu-icon');
let navbar = document.querySelector('.navbar');

menuIcon.onclick = () => {
    menuIcon.classList.toggle('bx-x');
    navbar.classList.toggle('active');
}

const aiLauncher = document.querySelector('#ai-chat-launcher');
const aiPanel = document.querySelector('#ai-chat-panel');
const aiClose = document.querySelector('#ai-chat-close');
const aiNudge = document.querySelector('#ai-agent-nudge');
const aiNudgeClose = document.querySelector('#ai-nudge-close');
const aiForm = document.querySelector('#ai-chat-form');
const aiInput = document.querySelector('#ai-chat-input');
const aiMessages = document.querySelector('#ai-chat-messages');
const aiSuggestions = document.querySelector('#ai-suggestions');

function setChatOpen(open) {
    aiPanel.classList.toggle('active', open);
    aiPanel.setAttribute('aria-hidden', String(!open));
    aiLauncher.classList.toggle('active', open);
    aiNudge.classList.remove('visible');
    if (open) setTimeout(() => aiInput.focus(), 180);
}

function addMessage(text, type) {
    const message = document.createElement('div');
    message.className = `ai-message ai-message-${type}`;
    message.textContent = text;
    aiMessages.appendChild(message);
    aiMessages.scrollTop = aiMessages.scrollHeight;
    return message;
}

async function askSumit(question) {
    addMessage(question, 'user');
    aiInput.value = '';
    aiInput.style.height = '';
    aiSuggestions.hidden = true;

    const typing = addMessage('Thinking...', 'bot');
    typing.classList.add('ai-message-typing');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to reach the portfolio agent.');
        typing.textContent = data.answer;
    } catch (error) {
        typing.textContent = error.message || 'The portfolio agent is temporarily unavailable.';
        typing.classList.add('ai-message-error');
    } finally {
        typing.classList.remove('ai-message-typing');
        aiMessages.scrollTop = aiMessages.scrollHeight;
    }
}

aiLauncher.addEventListener('click', () => setChatOpen(!aiPanel.classList.contains('active')));
aiClose.addEventListener('click', () => setChatOpen(false));
aiNudgeClose.addEventListener('click', () => aiNudge.classList.remove('visible'));

aiForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const question = aiInput.value.trim();
    if (question) askSumit(question);
});

aiInput.addEventListener('input', () => {
    aiInput.style.height = 'auto';
    aiInput.style.height = `${Math.min(aiInput.scrollHeight, 110)}px`;
});

aiInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        aiForm.requestSubmit();
    }
});

aiSuggestions.addEventListener('click', (event) => {
    if (event.target.matches('button')) askSumit(event.target.textContent);
});

setTimeout(() => {
    if (!aiPanel.classList.contains('active')) aiNudge.classList.add('visible');
}, 1800);
