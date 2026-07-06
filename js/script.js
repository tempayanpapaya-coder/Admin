// --- CONFIG FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyATIQKEoacfqd_P5mBn915gzwbsLQE-va8",
    authDomain: "spp-unisri-taekwondo.firebaseapp.com",
    projectId: "spp-unisri-taekwondo",
    storageBucket: "spp-unisri-taekwondo.firebasestorage.app",
    messagingSenderId: "888126318699",
    appId: "1:888126318699:web:6e1ef3d5a49908c2b5692e"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

function getMingguKe() {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const tanggal = now.getDate();
    if (tanggal < 3) return 4;
    if (tanggal >= 31) return 1;
    return Math.floor((tanggal - 3) / 7) + 1;
}

function getMingguKey() {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const tahun = now.getFullYear();
    const bulan = now.getMonth() + 1;
    const mingguKe = getMingguKe();
    return `${tahun}-${bulan}-Minggu-${mingguKe}`;
}

// --- JAM REALTIME INDONESIA & JAWA ---
setInterval(() => {
    const now = new Date();
    document.getElementById("clock-time").innerText = now.toLocaleTimeString("id-ID");
    document.getElementById("clock-date").innerText = now.toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}, 1000);

// --- CACHE DATA ATLIT (untuk Daftar Nama Atlit & Profil Biodata) ---
let atlitDataCache = {};
let currentProfilId = null;

// --- LOAD DATA ---
function loadData() {
    const cari = document.getElementById("searchInput").value.toLowerCase();
    const mingguNow = getMingguKey();
    db.collection("siswa").onSnapshot(snapshot => {
        let html = "";
        let total = 0, lunas = 0, belum = 0;
        atlitDataCache = {};

        // Kumpulkan & urutkan semua atlit berdasarkan nama untuk Daftar Nama Atlit
        let semuaAtlit = [];
        snapshot.forEach(doc => {
            atlitDataCache[doc.id] = doc.data();
            semuaAtlit.push({ id: doc.id, nama: doc.data().nama || "-" });
        });
        semuaAtlit.sort((a, b) => a.nama.localeCompare(b.nama, "id"));
        renderDaftarAtlitList(semuaAtlit);

        // Jika kartu profil sedang terbuka, refresh datanya secara realtime
        if (currentProfilId && atlitDataCache[currentProfilId]) {
            renderProfilAtlit(currentProfilId);
        }

        snapshot.forEach(doc => {
            const d = doc.data();
            if (!(d.nama || "").toLowerCase().includes(cari)) return;

            total++;
            const punyaKuota = parseInt(d.kuota_kas || 0) > 0;
            const isLunas = (d.minggu_bayar === mingguNow) || punyaKuota;
            isLunas ? lunas++ : belum++;

            let tombolPeringatan = "";
            if (!isLunas) {
                tombolPeringatan = `<button class="btn btn-caution" style="padding: 5px 10px;" onclick="peringatkan('${doc.id}')">⚠️</button>`;
            }
// --- FORMAT TANGGAL INDONESIA YANG RAPI ---
let tglLahirIndo = "-";
if (d.tanggal_lahir) {
    const opsi = { day: 'numeric', month: 'short', year: 'numeric' }; // Menggunakan nama bulan pendek (Jan, Feb, Mei) agar hemat ruang di tabel
    tglLahirIndo = new Date(d.tanggal_lahir).toLocaleDateString("id-ID", opsi);
}

html += `
<tr>
    <td data-label="Nama (Klik Riwayat)" onclick="lihatRiwayat('${doc.id}')" style="cursor:pointer; color:#60a5fa; font-weight:bold;">${d.nama || "-"}</td>
    <td data-label="Sabuk">${d.warna_sabuk || "-"}</td>
    <td data-label="No HP">${d.nomor_hp || "-"}</td>
    <td data-label="Tgl Lahir" style="color: #f3e5ab; white-space: nowrap;">📅 ${tglLahirIndo}</td>
    <td data-label="Fisik">${d.berat_badan || 0}kg / ${d.tinggi_badan || 0}cm</td>
    <td data-label="Status">
        <span class="badge ${isLunas ? 'green' : 'red'}">${isLunas ? 'Lunas' : 'Belum'}</span>
        ${punyaKuota ? `<div style="font-size:11px; opacity:0.7; margin-top:4px; color:#38bdf8;">Sisa: ${d.kuota_kas} Mgg</div>` : ''}
    </td>
    <td data-label="Aksi">
        <button class="btn btn-pay" onclick="bayar('${doc.id}')" ${isLunas ? 'disabled style="opacity:0.5"' : ''}>Bayar</button>
        <button class="btn" style="background-color: #eab308; color: #000; font-weight: bold;" onclick="koreksiKuotaManual('${doc.id}')">CELENGAN</button>
        <button class="btn btn-edit" onclick="editData('${doc.id}')">Edit</button>
        <button class="btn btn-delete" onclick="hapus('${doc.id}')">Hapus</button>
        ${tombolPeringatan}
    </td>
</tr>`;

        });

        document.getElementById("table-body").innerHTML = html;
        document.getElementById("totalMember").innerText = total;
        document.getElementById("totalLunas").innerText = lunas;
        document.getElementById("totalBelum").innerText = belum;
        document.getElementById("pemasukan").innerText = "Rp" + (lunas * 5000).toLocaleString("id-ID");

        const menuDot = document.getElementById("menuDot");
        if (menuDot) menuDot.classList.toggle("show", belum > 0);
    });
}

function peringatkan(id) {
    if (!confirm("Kirim peringatan ke member?")) return;
    db.collection("siswa").doc(id).update({
        peringatan: true,
        peringatan_dilihat: false,
        tanggal_peringatan: new Date().toISOString()
    }).then(() => { alert("Peringatan berhasil dikirim!"); });
}

function bayar(id) {
    const jumlahMingguInput = prompt("Mau bayar berapa minggu sekaligus?\n\nKetik angka minggu:", "1");
    if (jumlahMingguInput === null) return; 

    const jumlahMinggu = parseInt(jumlahMingguInput);
    if (isNaN(jumlahMinggu) || jumlahMinggu <= 0) {
        alert("Pembayaran dibatalkan.");
        return;
    }

    const mingguIni = getMingguKey();
    const ref = db.collection("siswa").doc(id);

    ref.get().then(doc => {
        const d = doc.data();
        let riwayat = d.riwayat_kas || [];
        let kuotaSekarang = parseInt(d.kuota_kas || 0) + jumlahMinggu;

        const now = new Date();
        const namaHari = now.toLocaleDateString("id-ID", { weekday: "long" });
        const tanggalLengkap = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
        const totalUang = jumlahMinggu * 5000;

        let textRiwayat = `Bayar Kas (${jumlahMinggu} Minggu - Rp${totalUang.toLocaleString('id-ID')}) • ${namaHari}, ${tanggalLengkap}`;
        riwayat.push(textRiwayat);
        
        ref.update({
            minggu_bayar: mingguIni,
            kuota_kas: kuotaSekarang,
            status_pembayaran: "Lunas",
            riwayat_kas: riwayat,
            peringatan: false,
            peringatan_dilihat: true
        }).then(() => {
            alert(`🎉 Berhasil mencatat pembayaran kas untuk ${jumlahMinggu} minggu!`);
        });
    });
}

function openAddModal() {
    document.getElementById("studentForm").reset();
    document.getElementById("student-id").value = "";
    document.getElementById("modalTitle").innerText = "Tambah Member";
    document.getElementById("studentModal").style.display = "block";
}

function closeModal() { document.getElementById("studentModal").style.display = "none"; }

document.getElementById("studentForm").onsubmit = function(e) {
    e.preventDefault();
    const id = document.getElementById("student-id").value;
    const status = document.getElementById("form-status").value;
    const mingguNow = getMingguKey();

    let data = {
        nama: document.getElementById("form-nama").value,
        username: document.getElementById("form-username").value,
        password: document.getElementById("form-password").value,
        nomor_hp: document.getElementById("form-hp").value,
        tanggal_lahir: document.getElementById("form-tgl").value,
        berat_badan: document.getElementById("form-berat").value,
        tinggi_badan: document.getElementById("form-tinggi").value,
        warna_sabuk: document.getElementById("form-sabuk").value
    };

    if (id) {
        const ref = db.collection("siswa").doc(id);
        ref.get().then(doc => {
            let lama = doc.data();
            let riwayat = lama.riwayat_kas || [];

            if (status === "Belum Lunas") {
                data.minggu_bayar = "";
                data.kuota_kas = 0;
                const now = new Date();
                riwayat.push(`⚠️ Koreksi Admin: Diubah ke Belum Lunas (${now.toLocaleDateString("id-ID")})`);
                data.riwayat_kas = riwayat;
            } else {
                data.kuota_kas = parseInt(lama.kuota_kas || 0);
                if (data.kuota_kas === 0) data.kuota_kas = 1;
                data.minggu_bayar = mingguNow;
            }

            ref.update(data).then(() => { loadData(); closeModal(); });
        });
    } else {
        if (status === "Lunas") {
            data.minggu_bayar = mingguNow;
            data.kuota_kas = 1;
        } else {
            data.minggu_bayar = "";
            data.kuota_kas = 0;
        }
        db.collection("siswa").add(data).then(() => { loadData(); closeModal(); });
    }
};

function editData(id) {
    db.collection("siswa").doc(id).get().then(doc => {
        const d = doc.data();
        const mingguNow = getMingguKey();
        
        document.getElementById("student-id").value = id;
        document.getElementById("form-nama").value = d.nama || "";
        document.getElementById("form-username").value = d.username || "";
        document.getElementById("form-password").value = d.password || "";
        document.getElementById("form-hp").value = d.nomor_hp || "";
        document.getElementById("form-tgl").value = d.tanggal_lahir || "";
        document.getElementById("form-berat").value = d.berat_badan || "";
        document.getElementById("form-tinggi").value = d.tinggi_badan || "";
        document.getElementById("form-sabuk").value = d.warna_sabuk || "Putih";
        
        const punyaKuota = parseInt(d.kuota_kas || 0) > 0;
        const isLunas = (d.minggu_bayar === mingguNow) || punyaKuota;
        document.getElementById("form-status").value = isLunas ? "Lunas" : "Belum Lunas";
        
        document.getElementById("modalTitle").innerText = "Edit Member";
        document.getElementById("studentModal").style.display = "block";
    });
}

function hapus(id) {
    if (confirm("Ingin Menendang Anak ini?")) db.collection("siswa").doc(id).delete();
}

function lihatRiwayat(id) {
    db.collection("siswa").doc(id).get().then(doc => {
        const riwayat = doc.data().riwayat_kas || [];
        let html = riwayat.length ? "" : "<p style='color:black;'>Belum ada riwayat.</p>";
        riwayat.sort().reverse().forEach(b => {
            html += `<div style="padding:10px; margin:5px 0; background:#f3f4f6; border-radius:8px; color:#111; font-weight:bold;">✅ ${b}</div>`;
        });
        document.getElementById("historyContent").innerHTML = html;
        document.getElementById("historyModal").style.display = "block";
    });
}

function closeHistory() { document.getElementById("historyModal").style.display = "none"; }

// ================== DAFTAR NAMA ATLIT ==================
function bukaDaftarAtlit() {
    document.getElementById("searchAtlitInput").value = "";
    document.getElementById("daftarAtlitModal").style.display = "block";
    filterDaftarAtlit();
}

function tutupDaftarAtlit() {
    document.getElementById("daftarAtlitModal").style.display = "none";
}

function renderDaftarAtlitList(daftarAtlit) {
    // Simpan data mentah supaya bisa difilter ulang tanpa nunggu snapshot baru
    window._daftarAtlitRaw = daftarAtlit;
    filterDaftarAtlit();
}

function filterDaftarAtlit() {
    const list = window._daftarAtlitRaw || [];
    const kataKunci = (document.getElementById("searchAtlitInput")?.value || "").toLowerCase();
    const hasil = list.filter(a => a.nama.toLowerCase().includes(kataKunci));

    let html = "";
    hasil.forEach(a => {
        html += `<div class="atlit-list-item" onclick="bukaProfilAtlit('${a.id}')">
            <span>${a.nama}</span><span class="chevron">›</span>
        </div>`;
    });

    document.getElementById("daftarAtlitList").innerHTML = html || `<div class="atlit-list-empty">Tidak ada atlit ditemukan</div>`;
}

// ================== PROFIL BIODATA ATLIT ==================
function bukaProfilAtlit(id) {
    currentProfilId = id;
    document.getElementById("profilAtlitModal").style.display = "block";
    renderProfilAtlit(id);
}

function tutupProfilAtlit() {
    currentProfilId = null;
    document.getElementById("profilAtlitModal").style.display = "none";
}

function renderProfilAtlit(id) {
    const d = atlitDataCache[id];
    if (!d) { tutupProfilAtlit(); return; }

    const mingguNow = getMingguKey();
    const punyaKuota = parseInt(d.kuota_kas || 0) > 0;
    const isLunas = (d.minggu_bayar === mingguNow) || punyaKuota;

    let tglLahirIndo = "-";
    if (d.tanggal_lahir) {
        const opsi = { day: 'numeric', month: 'long', year: 'numeric' };
        tglLahirIndo = new Date(d.tanggal_lahir).toLocaleDateString("id-ID", opsi);
    }

    const inisial = (d.nama || "-").trim().split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();

    const riwayat = (d.riwayat_kas || []).slice().sort().reverse().slice(0, 3);
    let riwayatHtml = riwayat.length
        ? riwayat.map(r => `<div class="riwayat-row">✅ ${r}</div>`).join("")
        : `<div class="riwayat-row" style="opacity:.6;">Belum ada riwayat pembayaran.</div>`;

    const html = `
        <div class="profil-header">
            <div class="profil-avatar">${inisial || "?"}</div>
            <h2>${d.nama || "-"}</h2>
            <div class="profil-sabuk">🥋 Sabuk ${d.warna_sabuk || "-"}</div>
        </div>

        <div class="profil-info-grid">
            <div class="profil-info-item"><div class="label">No. HP</div><div class="value">${d.nomor_hp || "-"}</div></div>
            <div class="profil-info-item"><div class="label">Tgl Lahir</div><div class="value">${tglLahirIndo}</div></div>
            <div class="profil-info-item"><div class="label">Berat Badan</div><div class="value">${d.berat_badan || 0} Kg</div></div>
            <div class="profil-info-item"><div class="label">Tinggi Badan</div><div class="value">${d.tinggi_badan || 0} Cm</div></div>
        </div>

        <div class="profil-status-box ${isLunas ? 'lunas' : 'belum'}">
            <div style="font-size:13px; opacity:.8; letter-spacing:1px;">STATUS KAS MINGGU INI</div>
            <div style="font-size:20px; font-weight:900; margin-top:4px;">${isLunas ? '✅ LUNAS' : '❌ BELUM LUNAS'}</div>
            ${punyaKuota ? `<div style="margin-top:6px; font-size:12px; color:#38bdf8;">Sisa Kuota: ${d.kuota_kas} Minggu</div>` : ''}
        </div>

        <h3 style="font-size:13px; letter-spacing:1px; color:#d4af37; margin-bottom:8px;">📜 RIWAYAT TERAKHIR</h3>
        <div class="profil-riwayat-mini">${riwayatHtml}</div>
        <button class="btn" style="width:100%; background:#3a3a3a; margin-bottom:18px;" onclick="lihatRiwayat('${id}')">📖 Lihat Semua Riwayat</button>

        <div class="profil-action-grid">
            <button class="btn btn-pay" ${isLunas ? 'disabled style="opacity:0.5; width:100%;"' : 'style="width:100%;"'} onclick="bayar('${id}')">💰 Bayar</button>
            <button class="btn" style="width:100%; background-color:#eab308; color:#000; font-weight:bold;" onclick="koreksiKuotaManual('${id}')">🐷 Celengan</button>
            <button class="btn btn-edit" style="width:100%;" onclick="editData('${id}')">✏️ Edit</button>
            <button class="btn btn-delete" style="width:100%;" onclick="hapusDariProfil('${id}')">🗑️ Hapus</button>
            ${!isLunas ? `<button class="btn btn-caution" style="width:100%; grid-column: 1 / -1;" onclick="peringatkan('${id}')">⚠️ Kirim Peringatan</button>` : ''}
        </div>
    `;

    document.getElementById("profilAtlitBody").innerHTML = html;
}

// Hapus dari kartu profil, sekaligus menutup kartu profil setelah berhasil
function hapusDariProfil(id) {
    if (!confirm("Ingin Menendang Anak ini?")) return;
    db.collection("siswa").doc(id).delete().then(() => {
        tutupProfilAtlit();
    });
}

function exportExcel(){
    db.collection("siswa").get().then(snapshot=>{
        const mingguNow = getMingguKey();
        let rows = [["BMI TAEKWONDO ACADEMY"], ["Management Member System"], [], ["NO","NAMA","USERNAME","PASSWORD","NO HP","TANGGAL LAHIR","BERAT","TINGGI","SABUK","STATUS","RIWAYAT"]];
        let no = 1;
        snapshot.forEach(doc=>{
            const d = doc.data();
            const status = d.minggu_bayar === mingguNow ? "LUNAS" : "BELUM";
            rows.push([no++, d.nama || "-", d.username || "-", d.password || "-", d.nomor_hp || "-", d.tanggal_lahir || "-", (d.berat_badan || 0), (d.tinggi_badan || 0), d.warna_sabuk || "-", status, (d.riwayat_kas || []).join(", ")]);
        });
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DATA MEMBER BMI");
        XLSX.writeFile(wb, "DATA_MEMBER_BMI.xlsx");
    });
}

function toggleJadwalAdmin(show){ document.getElementById("jadwalModal").style.display = show ? "block" : "none"; }
function toggleAbsensiPopup(show){ document.getElementById("absensiModal").style.display = show ? "block" : "none"; if(show){ loadAbsensi(); } }

loadData();

// --- JADWAL SYSTEM ---
const hariList = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"];

function renderAdminJadwal(data = {}){
    let html = "";
    hariList.forEach(hari=>{
        html += `<div class="schedule-admin-card"><div class="schedule-admin-title">${hari.toUpperCase()}</div><div id="wrap-${hari}"></div><button class="btn btn-session" onclick="tambahSession('${hari}')">+ Tambah Session</button></div>`;
    });
    document.getElementById("jadwalAdmin").innerHTML = html;
    hariList.forEach(hari=>{
        const sessions = data[hari] || [];
        if(sessions.length === 0) { tambahSession(hari); }
        else { sessions.forEach(s=> tambahSession(hari, s.jam, s.type)); }
    });
}

function tambahSession(hari, jam="", type="pagi"){
    const id = Date.now() + Math.random();
    const html = `<div class="session-item" id="${id}"><div class="session-grid"><div><label>Jam</label><input type="time" class="jam-input" value="${jam}"></div><div><label>Type</label><select class="type-input"><option value="pagi" ${type==="pagi"?"selected":""}>Pagi</option><option value="siang" ${type==="siang"?"selected":""}>Siang</option><option value="sore" ${type==="sore"?"selected":""}>Sore</option><option value="malam" ${type==="malam"?"selected":""}>Malam</option></select></div></div><button class="btn btn-delete" style="margin-top:10px;" onclick="document.getElementById('${id}').remove()">Hapus</button></div>`;
    document.getElementById(`wrap-${hari}`).insertAdjacentHTML("beforeend", html);
}

function simpanJadwalGlobal(){
    const result = {};
    hariList.forEach(hari=>{
        const wrap = document.getElementById(`wrap-${hari}`);
        const items = wrap.querySelectorAll(".session-item");
        result[hari] = [];
        items.forEach(item=>{
            const jam = item.querySelector(".jam-input").value;
            const type = item.querySelector(".type-input").value;
            if(jam) result[hari].push({jam, type});
        });
    });
    db.collection("jadwal").doc("global").set(result).then(()=> alert("🔥 Jadwal tersimpan!"));
}

db.collection("jadwal").doc("global").onSnapshot(doc=>{
    if(doc.exists) renderAdminJadwal(doc.data());
    else renderAdminJadwal();
});

function getTodayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function getMonthKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}`; }

async function loadAbsensi() {
    const today = getTodayKey();
    const listContainer = document.getElementById("absensi-list");
    const tidakHadirContainer = document.getElementById("tidak-hadir-list");
    listContainer.innerHTML = "<p style='color:gray;'>Memuat daftar siswa...</p>";
    document.getElementById("absensi-tanggal").innerText = new Date().toLocaleDateString("id-ID");

    try {
        const siswaSnapshot = await db.collection("siswa").get();
        const absenDoc = await db.collection("absensi").doc(today).get();
        const absenData = absenDoc.exists ? (absenDoc.data().hadir || []) : [];

        let html = "";
        let tidakHadirHTML = "";
        let countHadir = 0;

        siswaSnapshot.forEach(doc => {
            const s = doc.data();
            const idSiswa = doc.id;
            const isChecked = absenData.includes(idSiswa);

            if(isChecked){
                countHadir++;
            }else{
                tidakHadirHTML += `<div style="padding:10px; margin-bottom:8px; background:rgba(239,68,68,0.15); border-radius:10px; border:1px solid rgba(239,68,68,0.2); color:white; font-weight:bold;">❌ ${s.nama || 'Tanpa Nama'}</div>`;
            }

            html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid rgba(255,255,255,0.1); background:rgba(0,0,0,0.2); margin-bottom:5px; border-radius:8px;"><span style="font-size:14px; color:white;">${s.nama || 'Tanpa Nama'}</span><input type="checkbox" style="width:22px; height:22px; cursor:pointer;" ${isChecked ? 'checked' : ''} onchange="toggleAbsen('${idSiswa}', this.checked)"></div>`;
        });

        listContainer.innerHTML = html;
        document.getElementById("total-hadir").innerText = countHadir;
        tidakHadirContainer.innerHTML = tidakHadirHTML || `<div style="padding:10px; background:rgba(34,197,94,0.15); border-radius:10px; color:white; font-weight:bold;">✅ Semua siswa hadir hari ini</div>`;
        updateRanking();
    } catch(error){
        listContainer.innerHTML = "<p style='color:red;'>Gagal memuat data.</p>";
    }
}

async function toggleAbsen(siswaId, isChecked) {
    const today = getTodayKey();
    const ref = db.collection("absensi").doc(today);
    try {
        if (isChecked) {
            await ref.set({ hadir: firebase.firestore.FieldValue.arrayUnion(siswaId) }, { merge: true });
        } else {
            await ref.update({ hadir: firebase.firestore.FieldValue.arrayRemove(siswaId) });
        }
        loadAbsensi();
    } catch (e) { console.error(e); }
}

async function updateRanking() {
    const month = getMonthKey();
    const snapshot = await db.collection("absensi").get();
    const stats = {};

    snapshot.forEach(doc => {
        if (doc.id.startsWith(month)) {
            const hadir = doc.data().hadir || [];
            hadir.forEach(id => { stats[id] = (stats[id] || 0) + 1; });
        }
    });

    const siswaSnap = await db.collection("siswa").get();
    const rankData = [];
    siswaSnap.forEach(doc => {
        if (stats[doc.id]) { rankData.push({ nama: doc.data().nama, count: stats[doc.id] }); }
    });

    rankData.sort((a, b) => b.count - a.count);
    const top3 = rankData.slice(0, 3);

    let html = "";
    top3.forEach((r, i) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
        html += `<div style="padding:5px; border-bottom:1px solid rgba(255,255,255,0.05)">${medal} ${r.nama} (${r.count}x)</div>`;
    });
    document.getElementById("ranking-kehadiran").innerHTML = html || "Belum ada data bulan ini";
}

function toggleBMIApp(show){ document.getElementById("bmiAppModal").style.display = show ? "block" : "none"; }

// --- BOTTOM NAV & DRAWER (MOBILE) ---
function toggleDrawer(show){
    document.getElementById("drawerOverlay").classList.toggle("open", show);
}

function scrollToBeranda(){
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- PWA: REGISTRASI SERVICE WORKER (biar bisa diinstall & jalan offline shell) ---
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .then(() => console.log("Service worker aktif ✅"))
            .catch((err) => console.warn("Gagal register service worker:", err));
    });
}

// --- PWA: TOMBOL "INSTALL APLIKASI KE HP" (muncul otomatis kalau browser support) ---
let deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    const btn = document.getElementById("installBtn");
    if (btn) btn.style.display = "block";
});

function installApp(){
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.finally(() => {
        deferredInstallPrompt = null;
        const btn = document.getElementById("installBtn");
        if (btn) btn.style.display = "none";
    });
}

window.addEventListener("appinstalled", () => {
    const btn = document.getElementById("installBtn");
    if (btn) btn.style.display = "none";
});

// --- STOPWATCH SYSTEM ---
let stopwatchInterval;
let elapsed = 0;
let running = false;
let lapCount = 1;
let round = 1;
let targetTime = 120000;
let nextRoundTarget = 120000;

function formatTime(ms){
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centiseconds = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${String(centiseconds).padStart(2,'0')}`;
}

function updateDisplay(){
    document.getElementById("stopwatchDisplay").innerText = formatTime(elapsed);
    const currentRoundTime = elapsed % targetTime;
    const percent = Math.min((currentRoundTime / targetTime) * 100, 100);
    document.getElementById("progressBar").style.width = percent + "%";

    if(elapsed >= nextRoundTarget){
        playBeep();
        round++;
        document.getElementById("roundText").innerText = round;
        nextRoundTarget = round * targetTime;
    }
}

function startStopwatch(){
    if(running) return;
    const menit = parseInt(document.getElementById("targetMinute").value) || 1;
    targetTime = menit * 60000;
    nextRoundTarget = (round * targetTime);
    running = true;
    const start = Date.now() - elapsed;
    stopwatchInterval = setInterval(()=>{ elapsed = Date.now() - start; updateDisplay(); },10);
}

function pauseStopwatch(){ running = false; clearInterval(stopwatchInterval); }

function resetStopwatch(){
    running = false; clearInterval(stopwatchInterval);
    elapsed = 0; lapCount = 1; round = 1; nextRoundTarget = targetTime;
    document.getElementById("roundText").innerText = "1";
    document.getElementById("progressBar").style.width = "0%";
    document.getElementById("lapContainer").innerHTML = "<p style='opacity:.6'>Belum ada lap</p>";
    document.getElementById("stopwatchDisplay").innerText = "00:00:00";
}

function saveLap(){
    const lap = document.createElement("div");
    lap.className = "lap-item";
    lap.innerHTML = `<span>🏆 LAP ${lapCount}</span><span>${formatTime(elapsed)}</span>`;
    document.getElementById("lapContainer").prepend(lap);
    lapCount++;
}

function playBeep(){
    const ctx = new(window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.type = "sine"; osc.frequency.value = 800; osc.connect(ctx.destination);
    osc.start(); setTimeout(()=>{ osc.stop(); },300);
}

function toggleBelumModal(show){ document.getElementById("belumBayarModal").style.display = show ? "block" : "none"; }

async function showBelumBayar(){
    toggleBelumModal(true);
    const list = document.getElementById("belumBayarList");
    list.innerHTML = "<p>Memuat data...</p>";
    const mingguNow = getMingguKey();
    const snapshot = await db.collection("siswa").get();
    let html = "";

    snapshot.forEach(doc=>{
        const d = doc.data();
        const punyaKuota = parseInt(d.kuota_kas || 0) > 0;
        const belumBayar = (d.minggu_bayar !== mingguNow) && !punyaKuota;

        if(belumBayar){
            // Mengubah format tanggal lahir dari YYYY-MM-DD menjadi format Indonesia yang rapi (Contoh: 17 Mei 2010)
            let tanggalLahirFormatted = "-";
            if (d.tanggal_lahir) {
                const opsiTanggal = { day: 'numeric', month: 'long', year: 'numeric' };
                tanggalLahirFormatted = new Date(d.tanggal_lahir).toLocaleDateString("id-ID", opsiTanggal);
            }

            html += `
            <div style="padding:14px; margin-bottom:10px; background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.2); border-radius:14px;">
                <div style="font-size:16px; font-weight:800; color:white;">${d.nama || "-"}</div>
                <div style="margin-top:5px; font-size:13px; opacity:.7;">🥋 Sabuk: ${d.warna_sabuk || "-"}</div>
                <div style="margin-top:5px; font-size:13px; opacity:.7;">📱 No. HP: ${d.nomor_hp || "-"}</div>
                <div style="margin-top:5px; font-size:13px; opacity:.9; color: #f3e5ab;">📅 Tgl Lahir: ${tanggalLahirFormatted}</div>
            </div>`;
        }
    });

    list.innerHTML = html || `<div style="padding:15px; background:rgba(34,197,94,.15); border-radius:14px; font-weight:bold;">✅ Semua member sudah bayar</div>`;
}


async function prosesPotongKuotaMingguan() {
    if (!confirm("Apakah Anda ingin menyinkronkan data untuk minggu baru?")) return;
    const snapshot = await db.collection("siswa").get();
    let totalDipotong = 0;
    const batch = db.batch();
    
    snapshot.forEach(doc => {
        const d = doc.data();
        const kuota = parseInt(d.kuota_kas || 0);
        if (kuota > 0) {
            batch.update(db.collection("siswa").doc(doc.id), { kuota_kas: kuota - 1 });
            totalDipotong++;
        }
    });
    await batch.commit();
    alert(`⚡ Sukses memotong kuota ${totalDipotong} member.`);
    loadData();
}

async function tombolResetManualBulan() {
    if (!confirm("⚠️ HAPUS SEMUA DATA BULANAN?")) return;
    const pengetikan = prompt("Ketik kata 'SETUJU':");
    if (pengetikan !== "SETUJU") return;

    const snapshot = await db.collection("siswa").get();
    const batch = db.batch();
    snapshot.forEach(doc => {
        batch.update(db.collection("siswa").doc(doc.id), {
            riwayat_kas: [], pembayaran: [], kuota_kas: 0, minggu_bayar: "", status_pembayaran: "Belum Lunas"
        });
    });
    await batch.commit();
    alert("🎉 Data dibersihkan!");
    loadData();
}

function koreksiKuotaManual(id) {
    const ref = db.collection("siswa").doc(id);
    ref.get().then(doc => {
        if (!doc.exists) return;
        const d = doc.data();
        const kuotaSekarang = parseInt(d.kuota_kas || 0);
        const inputKuotaBaru = prompt(`Koreksi kuota ${d.nama}:`, kuotaSekarang);
        if (inputKuotaBaru === null) return;
        
        const kuotaBaru = parseInt(inputKuotaBaru);
        let riwayat = d.riwayat_kas || [];
        riwayat.push(`✏️ Kuota dikoreksi ke ${kuotaBaru} Minggu.`);
        
        ref.update({
            kuota_kas: kuotaBaru,
            riwayat_kas: riwayat,
            minggu_bayar: kuotaBaru > 0 ? getMingguKey() : ""
        }).then(() => { loadData(); });
    });
}
