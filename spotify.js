const clientId = "170a4a8ba1944e80968c081a849e6c8f";
const redirectUri = "https://spotifytestfront.vercel.app/stats.html";
const scopes = "user-top-read user-read-private";

const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get("code");

/* =========================
   HELPERS
========================= */

function $(s){ return document.querySelector(s); }

function showLoader(){
  const l = $("#loader");
  if(l) l.style.display = "flex";
}

function hideLoader(){
  const l = $("#loader");
  if(l) l.style.display = "none";
}

function clearContainer(id){
  const el = document.getElementById(id);
  if(el) el.innerHTML = "";
}

/* =========================
   PKCE
========================= */

function generateRandomString(length){
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let str = "";
  for(let i=0;i<length;i++){
    str += chars.charAt(Math.floor(Math.random()*chars.length));
  }
  return str;
}

async function sha256(plain){
  const data = new TextEncoder().encode(plain);
  return await crypto.subtle.digest("SHA-256", data);
}

function base64encode(input){
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g,"")
    .replace(/\+/g,"-")
    .replace(/\//g,"_");
}

/* =========================
   LOGIN
========================= */

async function loginWithSpotify(){
  const verifier = generateRandomString(64);
  const challenge = base64encode(await sha256(verifier));

  localStorage.setItem("spotify_verifier", verifier);

  const url =
    "https://accounts.spotify.com/authorize?" +
    "client_id=" + encodeURIComponent(clientId) +
    "&response_type=code" +
    "&redirect_uri=" + encodeURIComponent(redirectUri) +
    "&scope=" + encodeURIComponent(scopes) +
    "&code_challenge_method=S256" +
    "&code_challenge=" + encodeURIComponent(challenge);

  window.location.href = url;
}

function setupLoginButton(){
  const btn = document.getElementById("loginSpotify");
  if(!btn) return;
  btn.addEventListener("click", loginWithSpotify);
}

function toggleLoginButton(){
  const btn = document.getElementById("loginSpotify");
  if(!btn) return;

  const token = localStorage.getItem("spotify_access_token");

  if(token){
    btn.classList.add("hidden");
  }else{
    btn.classList.remove("hidden");
  }
}

/* =========================
   TOKEN
========================= */

async function getToken(){
  const verifier = localStorage.getItem("spotify_verifier");

  const res = await fetch("https://accounts.spotify.com/api/token",{
    method:"POST",
    headers:{
      "Content-Type":"application/x-www-form-urlencoded"
    },
    body:new URLSearchParams({
      client_id:clientId,
      grant_type:"authorization_code",
      code:code,
      redirect_uri:redirectUri,
      code_verifier:verifier
    })
  });

  const data = await res.json();

  if(!res.ok){
    console.error("TOKEN ERROR:", data);
    throw new Error("Erro ao pegar token");
  }

  localStorage.setItem("spotify_access_token", data.access_token);
}

function getTokenSaved(){
  return localStorage.getItem("spotify_access_token");
}

function clearSession(){
  localStorage.removeItem("spotify_access_token");
  localStorage.removeItem("spotify_verifier");
}

/* =========================
   API
========================= */

async function fetchApi(endpoint){
  const token = getTokenSaved();
  if(!token) throw new Error("Sem token");

  const res = await fetch("https://api.spotify.com/v1/"+endpoint,{
    headers:{
      Authorization:"Bearer "+token
    }
  });

  const data = await res.json();

  if(!res.ok){
    console.error("API ERROR:", data);

    if(res.status === 401){
      clearSession();
      location.reload();
    }

    throw new Error("Erro API");
  }

  return data;
}

/* =========================
   PROFILE
========================= */

async function renderProfile(){
  const data = await fetchApi("me");

  const name = $(".username");
  const avatar = $(".avatar");

  if(name) name.textContent = data.display_name || "User";

  if(avatar && data.images?.length){
    avatar.src = data.images[0].url;
  }
}

/* =========================
   TRACKS
========================= */

async function renderTracks(){
  const data = await fetchApi("me/top/tracks?limit=5");
  const container = document.getElementById("tracksContainer");

  container.innerHTML = "";

  data.items.forEach(track => {
    const img = track.album.images[1]?.url || track.album.images[0]?.url || "";

    container.innerHTML += `
      <div class="item">
        <img src="${img}" alt="${track.name}">
        <div class="item-text">
          <span class="artist">${track.artists[0].name}</span>
          <p>${track.name}</p>
        </div>
      </div>
    `;
  });
}

/* =========================
   ALBUMS
========================= */

async function renderAlbums(){
  const data = await fetchApi("me/top/tracks?limit=20");
  const container = document.getElementById("albumsContainer");

  container.innerHTML = "";

  const seen = new Set();
  const uniqueAlbums = [];

  data.items.forEach(track => {
    if(seen.has(track.album.id)) return;
    seen.add(track.album.id);

    uniqueAlbums.push({
      artist: track.artists[0].name,
      name: track.album.name,
      image: track.album.images[1]?.url || track.album.images[0]?.url || ""
    });
  });

  uniqueAlbums.slice(0,5).forEach(album => {
    container.innerHTML += `
      <div class="item">
        <img src="${album.image}" alt="${album.name}">
        <div class="item-text">
          <span class="artist">${album.artist}</span>
          <p>${album.name}</p>
        </div>
      </div>
    `;
  });
}

/* =========================
   SHARE CARD PRINCIPAL
========================= */

function downloadImage(name){
  const card = document.querySelector(".stats-card");
  if(!card) return;

  html2canvas(card,{scale:2}).then(canvas => {
    const link = document.createElement("a");
    link.download = name;
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
}

function setupShare(){
  const ig = document.getElementById("shareInstagram");
  const x = document.getElementById("shareX");

  if(ig){
    ig.addEventListener("click",()=>downloadImage("spotify-stats-instagram.png"));
  }

  if(x){
    x.addEventListener("click",()=>downloadImage("spotify-stats-x.png"));
  }
}

/* =========================
   WRAPPED
========================= */

async function getTopTracksData(limit = 5){
  const data = await fetchApi(`me/top/tracks?limit=${limit}`);
  return data.items || [];
}

async function renderWrapped(){
  const wrappedCard = document.getElementById("wrappedCard");
  const wrappedTracks = document.getElementById("wrappedTracks");
  const wrappedName = document.querySelector(".wrapped-name");
  const wrappedTopImage = document.querySelector(".wrapped-top-image");
  const wrappedTopTitle = document.querySelector(".wrapped-top-title");
  const wrappedTopArtist = document.querySelector(".wrapped-top-artist");

  if(!wrappedCard || !wrappedTracks) return;

  const profile = await fetchApi("me");
  const tracks = await getTopTracksData(5);

  if(!tracks.length) return;

  const topTrack = tracks[0];

  wrappedName.textContent = profile.display_name || "Usuário";
  wrappedTopImage.src = topTrack.album.images?.[0]?.url || "";
  wrappedTopTitle.textContent = topTrack.name || "---";
  wrappedTopArtist.textContent = topTrack.artists?.map(a => a.name).join(", ") || "---";

  wrappedTracks.innerHTML = "";

  tracks.forEach((track, index) => {
    wrappedTracks.innerHTML += `
      <div class="wrapped-track-item">
        <div class="wrapped-track-number">${index + 1}</div>
        <img class="wrapped-track-image" src="${track.album.images?.[1]?.url || track.album.images?.[0]?.url || ""}" alt="${track.name}">
        <div class="wrapped-track-text">
          <p>${track.name}</p>
          <span>${track.artists?.[0]?.name || "Artista"}</span>
        </div>
      </div>
    `;
  });

  wrappedCard.classList.remove("hidden");
}

function downloadWrapped(){
  const wrappedCard = document.getElementById("wrappedCard");
  if(!wrappedCard) return;

  html2canvas(wrappedCard, { scale: 2 }).then(canvas => {
    const link = document.createElement("a");
    link.download = "my-wrapped.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });
}

function setupWrappedButton(){
  const btn = document.getElementById("generateWrapped");
  if(!btn) return;

  btn.addEventListener("click", async () => {
    try{
      showLoader();
      await renderWrapped();
      downloadWrapped();
    }catch(err){
      console.error("Erro ao gerar wrapped:", err);
    }finally{
      hideLoader();
    }
  });
}

/* =========================
   INIT
========================= */

async function init(){
  showLoader();
  setupLoginButton();
  setupShare();
  setupWrappedButton();

  try{
    if(code){
      await getToken();
      window.history.replaceState({},document.title,"/stats.html");
    }

    if(getTokenSaved()){
      await renderProfile();
      await renderAlbums();
      await renderTracks();
    }
  }catch(err){
    console.error(err);
    clearContainer("albumsContainer");
    clearContainer("tracksContainer");
  }

  toggleLoginButton();
  hideLoader();
}

document.addEventListener("DOMContentLoaded", init);
