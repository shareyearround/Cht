document.addEventListener('DOMContentLoaded', () => {
    const socket = io(); // Hubungkan ke server Socket.IO
    console.log('Attempting to connect Socket.IO...'); 

    // Elemen UI
    const usernameContainer = document.getElementById('username-container');
    const chatContainer = document.getElementById('chat-container');
    const usernameInput = document.getElementById('username-input');
    const joinButton = document.getElementById('join-button');
    const usernameError = document.getElementById('username-error');

    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const displayUsername = document.getElementById('display-username');
    // const userCountSpan = document.getElementById('user-count'); // Jika ingin menampilkan jumlah user

    let currentUsername = null;

    // --- Fungsi Bantuan ---
    function addMessageToUI(data, type = 'message') {
        const messageElement = document.createElement('div');

        if (type === 'notification') {
            messageElement.classList.add('notification');
            messageElement.textContent = data.message; // data = { message: '...' }
        } else if (type === 'message') {
            messageElement.classList.add('message-bubble');

            // Tambahkan kelas 'self' jika pesan dari pengguna ini
            if (data.username === currentUsername) {
                messageElement.classList.add('self');
            } else {
                messageElement.classList.add('other');
            }

            // Tampilkan Nama Pengguna
            const usernameSpan = document.createElement('span');
            usernameSpan.classList.add('username');
            usernameSpan.textContent = data.username; // Selalu tampilkan username
            messageElement.appendChild(usernameSpan);

             // Tampilkan Teks Pesan
            const messageText = document.createElement('p');
            messageText.classList.add('message-text');
             // Sanitasi sederhana (opsional, tapi baik untuk mencegah XSS dasar)
            messageText.textContent = data.message; // Langsung pakai textContent lebih aman dari innerHTML
            messageElement.appendChild(messageText);

             // Opsional: Tambahkan Timestamp
             // const timestampSpan = document.createElement('span');
             // timestampSpan.classList.add('timestamp');
             // timestampSpan.textContent = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
             // messageElement.appendChild(timestampSpan);

        } else {
            return; // Tipe tidak dikenal
        }

        messagesContainer.appendChild(messageElement);
        // Auto scroll ke bawah
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function clearChatUI() {
        messagesContainer.innerHTML = ''; // Hapus semua pesan dari UI
    }


    // --- Logika Username ---
    function attemptJoinChat() {
        const username = usernameInput.value.trim();
        if (username) {
            usernameError.textContent = ''; // Hapus error lama
            socket.emit('setUsername', username);
        } else {
            usernameError.textContent = 'Nama pengguna tidak boleh kosong.';
        }
    }

    joinButton.addEventListener('click', attemptJoinChat);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            attemptJoinChat();
        }
    });

    // --- Event Listeners Socket.IO ---

    socket.on('usernameSuccess', (username) => {
        currentUsername = username;
        displayUsername.textContent = username; // Tampilkan nama di header chat
        usernameContainer.style.display = 'none'; // Sembunyikan form username
        chatContainer.style.display = 'flex'; // Tampilkan area chat
        messageInput.focus(); // Fokus ke input pesan
    });

    socket.on('usernameError', (errorMessage) => {
        usernameError.textContent = errorMessage;
    });

    socket.on('loadHistory', (history) => {
        console.log("Memuat riwayat chat...");
        clearChatUI(); // Kosongkan UI sebelum memuat riwayat
        history.forEach(msgData => addMessageToUI(msgData, 'message'));
        // Tambahkan notifikasi bahwa riwayat telah dimuat (opsional)
        addMessageToUI({ message: 'Riwayat chat sebelumnya dimuat.' }, 'notification');
    });

    socket.on('newMessage', (messageData) => {
        addMessageToUI(messageData, 'message');
    });

    socket.on('userNotification', (message) => {
        addMessageToUI({ message: message }, 'notification');
    });

    socket.on('chatReset', () => {
        clearChatUI();
        addMessageToUI({ message: 'Admin telah mereset chat.' }, 'notification');
        // Mungkin beri tahu pengguna untuk refresh jika ada state lain yang perlu direset di client
        // alert('Admin telah mereset chat. Halaman mungkin perlu dimuat ulang.');
    });

    // Opsional: Update daftar pengguna aktif
    // socket.on('updateUserList', (users) => {
    //     if (userCountSpan) {
    //         userCountSpan.textContent = users.length;
    //     }
    //     // Bisa juga tampilkan daftar nama pengguna di suatu tempat
    //     console.log('Pengguna aktif:', users);
    // });


    // --- Pengiriman Pesan ---
    function sendMessage() {
        const message = messageInput.value.trim();
        if (message && currentUsername) {
            socket.emit('sendMessage', message);
            messageInput.value = ''; // Kosongkan input setelah mengirim
        }
        messageInput.focus(); // Kembalikan fokus ke input
    }

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        // Kirim juga saat menekan Enter (tanpa Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Mencegah baris baru di input
            sendMessage();
        }
    });

    // Handle koneksi ulang (jika server restart atau koneksi putus sementara)
    socket.on('connect', () => {
    console.log('>>> TEST: Socket.IO Client Connected! Socket ID:', socket.id);
    alert('Berhasil terhubung ke server!');
        console.log('Terhubung kembali ke server.');
        // Jika sebelumnya sudah punya username, coba set ulang
        // Perlu penanganan state yang lebih baik jika ingin otomatis join ulang
        if (currentUsername) {
            console.log(`Mencoba join ulang sebagai ${currentUsername}`);
            // Penting: Server harus menghandle ini dengan baik, mungkin
            // menolak jika nama sudah diambil lagi atau mengizinkan re-join.
            // Implementasi server saat ini akan menolak jika nama sudah diambil.
            socket.emit('setUsername', currentUsername);
        } else {
            // Jika belum punya username (misal halaman baru dibuka setelah server restart)
            // kembali ke layar input username
            chatContainer.style.display = 'none';
            usernameContainer.style.display = 'block';
            usernameError.textContent = 'Koneksi terhubung. Silakan masukkan nama pengguna.';
        }
    });

    socket.on('serverSaysHello', (data) => {
    console.log('>>> TEST: Message from server:', data.message);
    alert(`Server menyapa: ${data.message}`); // Tampilkan popup lain
    });

    socket.on('connect_error', (err) => {
    console.error('>>> TEST: Socket.IO Connection Error:', err);
    alert(`Gagal terhubung: ${err.message}`); // Tampilkan error jika koneksi gagal
    });

    socket.on('disconnect', () => {
        console.log('Koneksi ke server terputus.');
        // Mungkin tampilkan pesan di UI
        addMessageToUI({ message: 'Koneksi terputus. Mencoba menghubungkan kembali...' }, 'notification');
        // Tidak perlu kembali ke layar username secara otomatis,
        // event 'connect' akan menangani saat berhasil terhubung lagi.
    });

});
