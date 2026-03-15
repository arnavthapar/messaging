async function loadMessages() {
    if (currentController) currentController.abort();
    currentController = new AbortController();
    const signal = currentController.signal;
    try {
        const sender = new URLSearchParams(window.location.search).get('sender');
        const group = new URLSearchParams(window.location.search).get('group');
        if (!sender && !group) return;

        const res = await fetch('/api/get_messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender: sender, group: group ? parseInt(group) : null, limit: limit }),
            signal
        });
        const data = await res.json();
        if (JSON.stringify(prevMessages) === JSON.stringify(data.messages)) {
            return; // prevent reloading screen when nothing changed
        }
        prevMessages = data.messages;
        document.getElementById('person').textContent = sender || data.groupName || group;
        if (data.groupName) {
            document.getElementById('person').textContent += " - (" + (data.groupUsers).join(', ') + ")";
        }
        document.getElementById('messages').innerHTML = '';
        const myUsername = await loadUsername();
        let prevMessage = null;
        let prevElement = null;
        for (const message of data.messages) {
            if (prevMessage && prevMessage.sender === message.sender && prevMessage.datetime === message.datetime) {
                // Combine nearby messages to make it more seamless
                const pval = document.createElement('p');
                const wrapper = document.createElement('div');
                wrapper.style.position = 'relative';
                pval.textContent = message.content;
                pval.style.margin = "0px";
                wrapper.appendChild(pval);
                pval.textContent = message.content;
                if (message.sender == myUsername) {
                    let trash = document.createElement('button');
                    trash.textContent = "🗑";
                    trash.id = message.id;
                    trash.classList = "trash-button redButton";
                    wrapper.appendChild(trash);
                }
                prevElement.appendChild(wrapper);
            } else {
                const wrapper = document.createElement('div');
                wrapper.classList = 'box message';
                if (message.sender === myUsername) {
                    wrapper.classList.add('ownMessage');
                }
                const h3 = document.createElement('h3');
                const pval = document.createElement('p');
                pval.style.position = 'relative';
                pval.style.margin = "0px";
                pval.textContent = message.content;
                h3.textContent = message.sender + " - " + message.datetime;
                h3.classList.add('wrap');
                wrapper.appendChild(h3);
                if (message.sender == myUsername) {
                    let trash = document.createElement('button');
                    trash.textContent = "🗑";
                    trash.id = message.id;
                    trash.classList = "trash-button redButton";
                    pval.appendChild(trash);
                }
                wrapper.appendChild(pval);
                document.getElementById('messages').appendChild(wrapper);
                prevElement = wrapper;
            }
            prevMessage = message;
        }
        if (data.extra) {
            const btnAdd = document.createElement('button');
            btnAdd.textContent = "Load More";
            btnAdd.onclick = () => {
                limit += 100;
                loadMessages();
                return;
        }
        document.getElementById('messages').prepend(btnAdd);};
        const messages = document.getElementById('messages');
        messages.scrollTop = messages.scrollHeight;
    } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
    }
}

async function loadSenders() {
    const res = await fetch('/api/get_senders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    document.getElementById('senderList').innerHTML = '';
    data.senders.forEach(item => {
        const btn = document.createElement('button');
        btn.textContent = item.person;
        if (item.type === 'group') {
            btn.onclick = () => window.location.href = '?group=' + encodeURIComponent(item.id);
            btn.classList = 'groupButton';
        } else {
            btn.onclick = () => window.location.href = '?sender=' + encodeURIComponent(item.person);
            btn.classList = 'dmButton';
        }
        document.getElementById('senderList').appendChild(btn);
    });
    if (sender || group)  {
        const btn = document.createElement('button');
        btn.classList = 'greyButton'
        btn.textContent = "+"
        btn.onclick = () => window.location.href = '/home';
        document.getElementById('senderList').appendChild(btn);
    }

}


async function loadUsername() {
    if (cachedUsername) return cachedUsername;
    const username = await fetch('/api/get_username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    const result = await username.json();
    document.getElementById('username').textContent = result.username;
    cachedUsername = result.username;
}
if (new URLSearchParams(window.location.search).get('sender') ||
    new URLSearchParams(window.location.search).get('group')) {
    document.getElementById('senderList').classList.add('conversation-open');
    document.getElementById('backButton').classList.add('conversation-open');
}
let cachedUsername = null;
let currentController = null;

loadSenders();
loadUsername();
let limit = 100
const sender = new URLSearchParams(window.location.search).get('sender');
const group = new URLSearchParams(window.location.search).get('group');

if (sender || group) {
    if (group) {
        const groupButton = document.getElementById('groupButton');
        groupButton.classList = 'groupButton';
        groupButton.onclick = () => {location.href='group_settings?sender=' + group}
        //document.getElementById('groupButton') = groupButton;
    }
    loadMessages();
    const quickMessageBox = document.getElementById('quickMessageSection');
    quickMessageBox.innerHTML =
        '<form id="quickMessageForm">' +
            '<input type="text" id="quickMessageInput" autocomplete="off" placeholder="Type a message...">' +
            '<button type="submit" value="send">Send</button>' +
        '</form>';
    document.getElementById('quickMessageForm').onsubmit = async (e) => {
        e.preventDefault();
        const submitter = e.submitter;
        const action = submitter?.value;
        if (action !== 'send') return;
        const res = await fetch('/api/send_message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: document.getElementById('quickMessageInput').value,
                recipient: sender || null,
                group: group ? parseInt(group) : null
            })
        });
        if (res.ok) {
            document.getElementById('messageStatus').textContent = 'Message sent!';
            document.getElementById('quickMessageInput').value = '';
        } else if (res.status === 413) {
            document.getElementById('messageStatus').textContent = 'Message cannot exceed 4000 characters.';
        } else if (res.status === 400) {
            const data = await res.json();
            document.getElementById('messageStatus').textContent = data.message;
        } else if (res.status === 429) {
            document.getElementById('messageStatus').textContent = 'You are sending messages too quickly!. Please wait and try again.';
        } else {
            document.getElementById('messageStatus').textContent = 'Failed to send message.';
        }
        loadSenders();
        loadMessages();
    };
} else {
    document.getElementById("messageNewDiv").classList = 'width96';
    document.getElementById("quickMessageSection").classList.add('hidden');
}

let prevMessages = [];
const evtSource = new EventSource('/api/stream');
let loadTimeout = null;
evtSource.onmessage = () => {
    if (loadTimeout) clearTimeout(loadTimeout);
    loadTimeout = setTimeout(() => loadMessages(), 200);
};
//setInterval(loadMessages, 5000);
setInterval(loadSenders, 60000);
document.getElementById('logoutButton').onclick = async () => {
    await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    window.location.href = '/';
};

document.getElementById('messages').addEventListener('click', async (e) => {
    if (e.target.classList.contains('trash-button')) {
        const id = e.target.id;
        await fetch('/api/delete_message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: id,
                dm: sender ? true : false
            })
        });
        await loadMessages();
    }
});
document.getElementById('messageForm').onsubmit = async (e) => {
    e.preventDefault();
    const submitter = e.submitter;
    const action = submitter?.value;
    if (action !== 'send') return;
    const res = await fetch('/api/send_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            content: document.getElementById('messageInput').value,
            recipient: document.getElementById('recipientInput').value
        })
    });
    if (res.ok) {
        document.getElementById('messageStatus').textContent = 'Message sent!';
    } else if (res.status === 413) {
        document.getElementById('messageStatus').textContent = 'Message cannot exceed 4000 characters.';
    } else if (res.status === 400) {
        const data = await res.json();
        document.getElementById('messageStatus').textContent = data.message;
    } else if (res.status === 429) {
        document.getElementById('messageStatus').textContent = 'You are sending messages too quickly!. Please wait and try again.';
    } else {
        document.getElementById('messageStatus').textContent = 'Failed to send message.';
    }
    loadSenders();
    loadMessages();
};
window.addEventListener('beforeunload', () => {
    evtSource.close();
});