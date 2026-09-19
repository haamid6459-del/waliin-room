let ws = null;

let myId = null;

let currentRoom = null;

let localStream = null;

let peers = {};

const rtcConfig = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    }
  ]
};


let clubs =
  JSON.parse(
    localStorage.getItem("waliin_clubs") || "[]"
  );

let follows =
  JSON.parse(
    localStorage.getItem("waliin_follows") || "[]"
  );


document.getElementById("name").value =
  localStorage.getItem("waliin_name") || "";


renderClubs();

updateFollow();


function saveName() {

  const name =
    document.getElementById("name")
    .value
    .trim() || "Guest";

  localStorage.setItem(
    "waliin_name",
    name
  );

  if (ws && ws.readyState === 1) {

    ws.send(
      JSON.stringify({
        type: "set-name",
        name: name
      })
    );

  }

}


function connectSocket() {

  if (
    ws &&
    ws.readyState === WebSocket.OPEN
  ) {
    return;
  }

  const protocol =
    location.protocol === "https:"
      ? "wss"
      : "ws";

  ws = new WebSocket(
    `${protocol}://${location.host}`
  );


  ws.onopen = () => {

    document.getElementById(
      "status"
    ).textContent = "🟢 Online";

    saveName();

    if (currentRoom) {

      ws.send(
        JSON.stringify({
          type: "join",
          room: currentRoom
        })
      );

    }

  };


  ws.onclose = () => {

    document.getElementById(
      "status"
    ).textContent = "🔴 Offline";

  };


  ws.onmessage = event => {

    try {

      const data =
        JSON.parse(event.data);

      handleMessage(data);

    } catch {}

  };

}


async function joinRoom() {

  currentRoom =
    document.getElementById("room")
    .value
    .trim()
    .replace(/\s+/g, "-")
    || "waliin-room";


  document.getElementById(
    "roomPanel"
  ).hidden = false;


  document.getElementById(
    "roomTitle"
  ).textContent = currentRoom;


  connectSocket();


  setTimeout(() => {

    if (
      ws &&
      ws.readyState === WebSocket.OPEN
    ) {

      saveName();

      ws.send(
        JSON.stringify({
          type: "join",
          room: currentRoom
        })
      );

    }

  }, 300);


  await getMedia();

  updateFollow();

}


function createRoom() {

  const room =
    prompt("Maqaa Room galchi:");

  if (!room) return;

  document.getElementById(
    "room"
  ).value = room;

  joinRoom();

}


async function getMedia() {

  if (localStream) return;

  try {

    localStream =
      await navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true
      });


    addVideo(
      "local",
      localStream,
      localStorage.getItem(
        "waliin_name"
      ) || "Ati"
    );

  } catch {

    addMessage(
      "System",
      "Camera fi microphone hayyama gaafata."
    );

  }

}


function addVideo(
  id,
  stream,
  name
) {

  let box =
    document.getElementById(
      "video-" + id
    );


  if (!box) {

    box =
      document.createElement("div");

    box.className =
      "videoBox";

    box.id =
      "video-" + id;


    box.innerHTML = `
      <video
        autoplay
        playsinline
        ${id === "local" ? "muted" : ""}
      ></video>

      <span class="label"></span>
    `;


    document.getElementById(
      "videos"
    ).appendChild(box);

  }


  box.querySelector(
    "video"
  ).srcObject = stream;


  box.querySelector(
    ".label"
  ).textContent = name;

}


function handleMessage(msg) {

  if (msg.type === "joined") {

    myId = msg.id;

    document.getElementById(
      "memberCount"
    ).textContent =
      `${msg.members.length + 1} members`;


    msg.members.forEach(
      member => {

        createOffer(
          member.id,
          member.name
        );

      }
    );

  }


  if (msg.type === "user-joined") {

    addMessage(
      "System",
      msg.user.name +
      " room seene."
    );

  }


  if (msg.type === "user-left") {

    closePeer(msg.id);

    document.getElementById(
      "video-" + msg.id
    )?.remove();

  }


  if (msg.type === "chat") {

    addMessage(
      msg.name || "Guest",
      msg.text
    );

  }


  if (msg.type === "offer") {

    receiveOffer(msg);

  }


  if (msg.type === "answer") {

    receiveAnswer(msg);

  }


  if (msg.type === "ice") {

    receiveIce(msg);

  }

}


function createPeer(
  id,
  name
) {

  if (peers[id]) {
    return peers[id];
  }


  const pc =
    new RTCPeerConnection(
      rtcConfig
    );


  peers[id] = pc;


  if (localStream) {

    localStream
      .getTracks()
      .forEach(track => {

        pc.addTrack(
          track,
          localStream
        );

      });

  }


  pc.onicecandidate =
    event => {

      if (
        event.candidate &&
        ws &&
        ws.readyState === 1
      ) {

        ws.send(
          JSON.stringify({
            type: "ice",
            to: id,
            candidate:
              event.candidate
          })
        );

      }

    };


  pc.ontrack =
    event => {

      addVideo(
        id,
        event.streams[0],
        name || "Guest"
      );

    };


  return pc;

}


async function createOffer(
  id,
  name
) {

  const pc =
    createPeer(id, name);


  const offer =
    await pc.createOffer();


  await pc.setLocalDescription(
    offer
  );


  ws.send(
    JSON.stringify({
      type: "offer",
      to: id,
      offer: offer
    })
  );

}


async function receiveOffer(msg) {

  const pc =
    createPeer(
      msg.from,
      msg.name
    );


  await pc.setRemoteDescription(
    msg.offer
  );


  const answer =
    await pc.createAnswer();


  await pc.setLocalDescription(
    answer
  );


  ws.send(
    JSON.stringify({
      type: "answer",
      to: msg.from,
      answer: answer
    })
  );

}


async function receiveAnswer(msg) {

  if (!peers[msg.from]) return;

  await peers[msg.from]
    .setRemoteDescription(
      msg.answer
    );

}


async function receiveIce(msg) {

  try {

    if (peers[msg.from]) {

      await peers[msg.from]
        .addIceCandidate(
          msg.candidate
        );

    }

  } catch {}

}


function sendChat() {

  const input =
    document.getElementById(
      "message"
    );


  const text =
    input.value.trim();


  if (!text || !ws) return;


  ws.send(
    JSON.stringify({
      type: "chat",
      text: text
    })
  );


  addMessage(
    "Ati",
    text
  );


  input.value = "";

}


function addMessage(
  name,
  text
) {

  const div =
    document.createElement("div");


  div.className = "msg";


  div.innerHTML =
    `<b>${escapeHTML(name)}</b>: ${escapeHTML(text)}`;


  document.getElementById(
    "messages"
  ).appendChild(div);


  const box =
    document.getElementById(
      "messages"
    );


  box.scrollTop =
    box.scrollHeight;

}


function escapeHTML(text) {

  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function toggleMic() {

  if (!localStream) return;

  const track =
    localStream
    .getAudioTracks()[0];


  if (!track) return;


  track.enabled =
    !track.enabled;


  document.getElementById(
    "micBtn"
  ).textContent =
    track.enabled
      ? "🎤 Mic"
      : "🔇 Mic";

}


function toggleCamera() {

  if (!localStream) return;

  const track =
    localStream
    .getVideoTracks()[0];


  if (!track) return;


  track.enabled =
    !track.enabled;


  document.getElementById(
    "camBtn"
  ).textContent =
    track.enabled
      ? "📹 Camera"
      : "🚫 Camera";

}


function startCall() {

  getMedia();

  addMessage(
    "System",
    "Call jalqabame."
  );

}


function closePeer(id) {

  if (peers[id]) {

    peers[id].close();

    delete peers[id];

  }

}


function leaveRoom() {

  Object.keys(peers)
    .forEach(closePeer);


  if (localStream) {

    localStream
      .getTracks()
      .forEach(
        track => track.stop()
      );

    localStream = null;

  }


  document.getElementById(
    "videos"
  ).innerHTML = "";


  document.getElementById(
    "roomPanel"
  ).hidden = true;


  currentRoom = null;

}


function toggleFollow() {

  const room =
    document.getElementById(
      "room"
    ).value.trim()
    || "waliin-room";


  if (follows.includes(room)) {

    follows =
      follows.filter(
        item => item !== room
      );

  } else {

    follows.push(room);

  }


  localStorage.setItem(
    "waliin_follows",
    JSON.stringify(follows)
  );


  updateFollow();

}


function updateFollow() {

  const room =
    document.getElementById(
      "room"
    ).value.trim()
    || "waliin-room";


  document.getElementById(
    "followBtn"
  ).textContent =
    follows.includes(room)
      ? "♥ Following"
      : "♡ Follow Room";

}


function createClub() {

  const club =
    document.getElementById(
      "club"
    ).value.trim();


  if (!club) return;


  if (!clubs.includes(club)) {

    clubs.push(club);

  }


  localStorage.setItem(
    "waliin_clubs",
    JSON.stringify(clubs)
  );


  renderClubs();

}


function renderClubs() {

  const box =
    document.getElementById(
      "clubs"
    );


  if (!clubs.length) {

    box.innerHTML =
      "<small>Club hinjiru.</small>";

    return;

  }


  box.innerHTML =
    clubs.map(
      club => `
        <div class="item">
          👥 ${escapeHTML(club)}

          <button
            onclick="joinClub('${escapeHTML(club)}')"
          >
            Join
          </button>
        </div>
      `
    ).join("");

}


function joinClub(club) {

  document.getElementById(
    "room"
  ).value = club;

  joinRoom();

}


function searchItems() {

  const query =
    document.getElementById(
      "search"
    ).value
    .toLowerCase();


  const items =
    [
      ...new Set(
        [...clubs, ...follows]
      )
    ];


  const results =
    items.filter(
      item =>
        item
        .toLowerCase()
        .includes(query)
    );


  document.getElementById(
    "results"
  ).innerHTML =
    results.map(
      item => `
        <div class="item">
          🔎 ${escapeHTML(item)}

          <button
            onclick="joinClub('${escapeHTML(item)}')"
          >
            Join
          </button>
        </div>
      `
    ).join("");

}


document.getElementById(
  "room"
).addEventListener(
  "input",
  updateFollow
);
