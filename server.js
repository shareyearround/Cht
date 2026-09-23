const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const HISTORY_FILE = path.join(__dirname, 'chat_history.json');

// Middleware untuk menyajikan file statis dari folder 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Manajemen State ---
let activeUsers = new Set(); // Menyimpan nama pengguna yang sedang aktif
let chatHistory = [];      // Menyimpan riwayat chat dalam memori

// --- Fungsi Bantuan ---
function loadChatHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
            chatHistory = JSON.parse(data);
            console.log('Riwayat chat berhasil dimuat.');
        } else {
            console.log('File riwayat chat tidak ditemukan, memulai dengan riwayat kosong.');
            saveChatHistory(); // Buat file kosong jika belum ada
        }
    } catch (err) {
        console.error('Gagal memuat riwayat chat:', err);
        chatHistory = []; // Mulai ulang dengan array kosong jika ada error
    }
}

function saveChatHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(chatHistory, null, 2), 'utf-8');
        // console.log('Riwayat chat berhasil disimpan.'); // Uncomment jika ingin log setiap save
    } catch (err) {
        console.error('Gagal menyimpan riwayat chat:', err);
    }
}

function resetChat() {
    console.log('\n!!! MERESET CHAT !!!');
    chatHistory = [];
    saveChatHistory();
    // Beri tahu semua klien bahwa chat telah direset
    io.emit('chatReset');
    console.log('Chat telah direset dan file history dikosongkan.');
}

// Muat riwayat chat saat server dimulai
loadChatHistory();

// --- Logika Socket.IO ---
io.on('connection', (socket) => {
    console.log(`>>> TEST CONNECTION ESTABLISHED: Socket ID ${socket.id}`);
    socket.emit('serverSaysHello', { message: `Connected successfully, your ID is ${socket.id}` });
    console.log(`User connected: ${socket.id}`);
    let currentUsername = null;

    // Kirim riwayat chat ke pengguna yang baru terhubung SETELAH mereka set username
    // socket.emit('loadHistory', chatHistory); // Pindahkan ini ke setelah set username

    // Handler untuk mengatur username
    socket.on('setUsername', (username) => {
        if (!username || username.trim().length === 0) {
            socket.emit('usernameError', 'Nama pengguna tidak boleh kosong.');
            return;
        }
        username = username.trim(); // Hapus spasi ekstra

        if (activeUsers.has(username)) {
            socket.emit('usernameError', `Nama pengguna "${username}" sudah digunakan. Coba nama lain.`);
        } else {
            currentUsername = username;
            activeUsers.add(currentUsername);
            socket.username = currentUsername; // Simpan username di objek socket

            console.log(`Username set for ${socket.id}: ${currentUsername}`);
            socket.emit('usernameSuccess', currentUsername); // Konfirmasi ke klien
            socket.emit('loadHistory', chatHistory); // Kirim riwayat SEKARANG

            // Beri tahu pengguna lain tentang pengguna baru
            socket.broadcast.emit('userNotification', `${currentUsername} telah bergabung.`);
            io.emit('updateUserList', Array.from(activeUsers)); // Update daftar pengguna (opsional)
        }
    });

    // Handler untuk pesan baru
    socket.on('sendMessage', (message) => {
        if (!currentUsername) {
            // Seharusnya tidak terjadi jika alur username benar, tapi sebagai pengaman
            console.warn(`Pesan diterima dari socket ${socket.id} tanpa username.`);
            return;
        }
        if (!message || message.trim().length === 0) {
            return; // Jangan kirim pesan kosong
        }

        const messageData = {
            username: currentUsername,
            message: message.trim(),
            timestamp: new Date().toISOString() // Tambahkan timestamp
        };

        // Tambahkan ke riwayat
        chatHistory.push(messageData);
        // Batasi riwayat jika perlu (misal: 100 pesan terakhir)
        // if (chatHistory.length > 100) {
        //    chatHistory.shift(); // Hapus pesan tertua
        // }

        // Simpan riwayat ke file
        saveChatHistory();

        // Kirim pesan ke semua klien yang terhubung
        io.emit('newMessage', messageData);
    });

    // Handler saat pengguna disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        if (currentUsername) {
            console.log(`Username ${currentUsername} disconnected.`);
            activeUsers.delete(currentUsername);
            // Beri tahu pengguna lain
            socket.broadcast.emit('userNotification', `${currentUsername} telah keluar.`);
            io.emit('updateUserList', Array.from(activeUsers)); // Update daftar pengguna (opsional)
        }
    });
});

// --- Halaman Utama ---
// (Tidak perlu route khusus karena sudah ditangani oleh express.static)
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// --- Fitur Reset Admin via Terminal ---
console.log('\n--- Kontrol Admin ---');
console.log('Ketik "reset" dan tekan Enter untuk menghapus semua riwayat chat.');
console.log('Ketik "users" dan tekan Enter untuk melihat pengguna aktif.');
console.log('Ketik "exit" atau tekan Ctrl+C untuk menghentikan server.');
console.log('--------------------\n');

process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', (text) => {
    const command = text.trim().toLowerCase();
    if (command === 'reset') {
        resetChat();
    } else if (command === 'users') {
        console.log('\n--- Pengguna Aktif ---');
        if (activeUsers.size > 0) {
            activeUsers.forEach(user => console.log(`- ${user}`));
        } else {
            console.log('Tidak ada pengguna yang aktif.');
        }
        console.log('--------------------\n');
    } else if (command === 'exit') {
        console.log('Menutup server...');
        process.exit();
    } else {
         // Abaikan input lain atau beri pesan bantuan
    }
});


server.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    // Di Termux, cari tahu IP lokal Anda (misal pakai 'ifconfig' atau 'ip addr')
    // Akses dari perangkat lain di jaringan yang sama via http://<IP_LOKAL_TERMUX>:${PORT}
});
