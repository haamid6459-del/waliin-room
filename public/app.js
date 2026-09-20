let ws = null;

let myId = null;
let currentRoom = null;

let localStream = null;

const peers = new Map();

const $ = id =>
  document.getElementById(id);


$("nameInput").value =
  localStorage.getItem("waliinName") || "";

$("settingsName").value =
  $("nameInput").value;


// ==========================
// WEBSOCKET
// ==========================

function connectSocket() {

  return new Promise((resolve, reject) => {

    const protocol =
      location.protocol === "https:"
        ? "wss:"
        : "ws:";

    ws = new WebSocket(
      `${protocol}//${location.host}`
    );

    ws.onopen = () => {

      $("status").textContent =
        "🟢 Server waliin wal qabate.";

      resolve();

    };

    ws.onerror = () => {

      $("status").textContent =
        "❌ Server connection error.";

      reject();

    };

    ws.onclose = () => {

      $("status").textContent =
        "🔴 Connection cufame.";

    };

    ws.onmessage = event => {

      let data;

      try {
        data =
          JSON.parse(event.data);
      } catch {
        return;
      }

      handleMessage(data);
    };

  });
}


// ==========================
// SERVER MESSAGES
// ==========================

function handleMessage(data) {

  if (data.type === "error") {

    alert(
      "❌ " + data.message
    );

    return;
  }


  // ROOM JOINED

  if (data.type === "joined") {

    myId = data.id;

    currentRoom =
      data.room;

    $("home")
      .classList
      .add("hidden");

    $("room")
      .classList
      .remove("hidden");

    $("roomTitle").textContent =
      "🏠 " + currentRoom;

    $("members").innerHTML =
      "";

    data.members
      .forEach(addMember);

    updateMemberCount();

    addMessage(
      "System",
      "Room keessatti milkooftee seente."
    );

    return;
  }


  // NEW USER

  if (data.type === "user-joined") {

    addMember(data.user);

    addMessage(
      "System",
      `${data.user.name} room seene.`
    );

    // Call jalqabuuf
    // namni haaraan offer argata.

    if (
      localStream &&
      data.user.id !== myId
    ) {

      createOffer(
        data.user.id
      );

    }

    return;
  }


  // USER LEFT

  if (data.type === "user-left") {

    removePeer(data.id);

    const member =
      $("member-" + data.id);

    if (member) {
      member.remove();
    }

    updateMemberCount();

    addMessage(
      "System",
      `${data.name || "User"} room keessaa ba'e.`
    );

    return;
  }


  // CHAT

  if (data.type === "chat") {

    addMessage(
      data.name || "Guest",
      data.message
    );

    return;
  }


  // WEBRTC OFFER

  if (data.type === "offer") {

    handleOffer(data);

    return;
  }


  // WEBRTC ANSWER

  if (data.type === "answer") {

    handleAnswer(data);

    return;
  }


  // ICE

  if (data.type === "ice") {

    handleIce(data);

    return;
  }

}


// ==========================
// MEMBERS
// ==========================

function addMember(user) {

  if (
    $("member-" + user.id)
  ) {
    return;
  }

  const div =
    document.createElement("div");

  div.className =
    "member";

  div.id =
    "member-" + user.id;

  div.textContent =
    "👤 " +
    user.name +
    (user.owner
      ? " 👑 Admin"
      : "");

  $("members")
    .appendChild(div);

  updateMemberCount();
}


function updateMemberCount() {

  $("memberCount")
    .textContent =
    $("members")
      .querySelectorAll(".member")
      .length;
}


// ==========================
// CREATE ROOM
// ==========================

$("showCreateBtn").onclick =
  () => {

    $("createBox")
      .classList
      .remove("hidden");

    $("joinBox")
      .classList
      .add("hidden");
  };


$("createBtn").onclick =
  async () => {

    const name =
      $("nameInput")
        .value
        .trim() || "Guest";

    const room =
      $("createRoomName")
        .value
        .trim();

    const password =
      $("createPassword")
        .value;

    if (!room) {

      alert(
        "Maqaa Room galchi."
      );

      return;
    }

    localStorage.setItem(
      "waliinName",
      name
    );

    try {

      if (
        !ws ||
        ws.readyState !==
        WebSocket.OPEN
      ) {

        await connectSocket();

      }

      ws.send(
        JSON.stringify({
          type: "set-name",
          name
        })
      );

      ws.send(
        JSON.stringify({
          type: "create-room",
          room,
          password
        })
      );

    } catch {

      alert(
        "Server waliin wal qunnamuun hin danda'amne."
      );

    }
  };


// ==========================
// JOIN ROOM
// ==========================

$("showJoinBtn").onclick =
  () => {

    $("joinBox")
      .classList
      .remove("hidden");

    $("createBox")
      .classList
      .add("hidden");
  };


$("joinBtn").onclick =
  async () => {

    const name =
      $("nameInput")
        .value
        .trim() || "Guest";

    const room =
      $("roomInput")
        .value
        .trim();

    const password =
      $("roomPassword")
        .value;

    if (!room) {

      alert(
        "Maqaa Room galchi."
      );

      return;
    }

    localStorage.setItem(
      "waliinName",
      name
    );

    try {

      if (
        !ws ||
        ws.readyState !==
        WebSocket.OPEN
      ) {

        await connectSocket();

      }

      ws.send(
        JSON.stringify({
          type: "set-name",
          name
        })
      );

      ws.send(
        JSON.stringify({
          type: "join",
          room,
          password
        })
      );

    } catch {

      alert(
        "Server waliin wal qunnamuun hin danda'amne."
      );

    }
  };


// ==========================
// CHAT
// ==========================

$("sendBtn").onclick =
  sendMessage;


$("messageInput")
  .addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Enter"
      ) {
        sendMessage();
      }

    }
  );


function sendMessage() {

  const text =
    $("messageInput")
      .value
      .trim();

  if (!text) return;

  if (
    !ws ||
    ws.readyState !==
    WebSocket.OPEN
  ) {

    alert(
      "Connection hin jiru."
    );

    return;
  }

  ws.send(
    JSON.stringify({
      type: "chat",
      message: text
    })
  );

  addMessage(
    "Ati",
    text
  );

  $("messageInput")
    .value = "";
}


function addMessage(
  name,
  text
) {

  const div =
    document.createElement("div");

  div.className =
    "message";

  if (name === "System") {
    div.classList.add(
      "system"
    );
  }

  div.textContent =
    `${name}: ${text}`;

  $("messages")
    .appendChild(div);

  $("messages")
    .scrollTop =
    $("messages")
      .scrollHeight;
}


// ==========================
// GET CAMERA + MICROPHONE
// ==========================

async function startMedia(
  video = true
) {

  try {

    if (localStream) {

      localStream
        .getTracks()
        .forEach(track =>
          track.stop()
        );
    }

    localStream =
      await navigator
        .mediaDevices
        .getUserMedia({

          audio: true,

          video: video

        });

    $("localVideo")
      .srcObject =
      localStream;

    // Existing peers irratti
    // tracks haaraa dabali.

    for (
      const [id, pc]
      of peers
    ) {

      localStream
        .getTracks()
        .forEach(track => {

          pc.addTrack(
            track,
            localStream
          );

        });

    }

    return true;

  } catch (error) {

    console.error(error);

    alert(
      "🎤📷 Camera/Microphone permission kenni."
    );

    return false;
  }
}


// ==========================
// MIC
// ==========================

$("micBtn").onclick =
  async () => {

    if (!localStream) {

      const ok =
        await startMedia(false);

      if (!ok) return;

      $("micBtn")
        .textContent =
        "🔇 Mic OFF";

      return;
    }

    const audio =
      localStream
        .getAudioTracks()[0];

    if (!audio) {

      const newStream =
        await navigator
          .mediaDevices
          .getUserMedia({
            audio: true
          });

      newStream
        .getAudioTracks()
        .forEach(track => {

          localStream.addTrack(
            track
          );

          for (
            const pc of peers.values()
          ) {

            pc.addTrack(
              track,
              localStream
            );

          }

        });

      $("micBtn")
        .textContent =
        "🎤 Mic ON";

      return;
    }

    audio.enabled =
      !audio.enabled;

    $("micBtn")
      .textContent =
      audio.enabled
        ? "🎤 Mic ON"
        : "🔇 Mic OFF";
  };


// ==========================
// CAMERA
// ==========================

$("cameraBtn").onclick =
  async () => {

    if (!localStream) {

      const ok =
        await startMedia(true);

      if (!ok) return;

      $("cameraBtn")
        .textContent =
        "📷 Camera ON";

      return;
    }

    const video =
      localStream
        .getVideoTracks()[0];

    if (!video) {

      const newStream =
        await navigator
          .mediaDevices
          .getUserMedia({
            video: true
          });

      newStream
        .getVideoTracks()
        .forEach(track => {

          localStream.addTrack(
            track
          );

          for (
            const pc of peers.values()
          ) {

            pc.addTrack(
              track,
              localStream
            );

          }

        });

      $("cameraBtn")
        .textContent =
        "📷 Camera ON";

      return;
    }

    video.enabled =
      !video.enabled;

    $("cameraBtn")
      .textContent =
      video.enabled
        ? "📷 Camera ON"
        : "📷 Camera OFF";
  };


// ==========================
// START CALL
// ==========================

$("callBtn").onclick =
  async () => {

    if (!currentRoom) {

      alert(
        "Dura Room seeni."
      );

      return;
    }

    const ok =
      await startMedia(true);

    if (!ok) return;

    $("callBtn")
      .textContent =
      "📞 Calling...";

    // Namoota room keessa jiran
    // hundaaf offer ergi.

    const memberElements =
      $("members")
        .querySelectorAll(".member");

    for (
      const element
      of memberElements
    ) {

      const id =
        element.id.replace(
          "member-",
          ""
        );

      if (id !== myId) {

        await createOffer(id);

      }
    }
  };


// ==========================
// PEER CONNECTION
// ==========================

function createPeerConnection(
  remoteId
) {

  if (peers.has(remoteId)) {

    return peers.get(remoteId);

  }

  const pc =
    new RTCPeerConnection({

      iceServers: [

        {
          urls:
            "stun:stun.l.google.com:19302"
        },

        {
          urls:
            "stun:stun1.l.google.com:19302"
        }

      ]

    });


  peers.set(
    remoteId,
    pc
  );


  // Local tracks

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


  // Remote stream

  pc.ontrack =
    event => {

      const stream =
        event.streams[0];

      if (!stream) return;

      showRemoteVideo(
        remoteId,
        stream
      );

    };


  // ICE

  pc.onicecandidate =
    event => {

      if (
        event.candidate
      ) {

        sendSignal({

          type: "ice",

          to: remoteId,

          candidate:
            event.candidate

        });

      }

    };


  pc.onconnectionstatechange =
    () => {

      if (
        pc.connectionState ===
        "failed" ||
        pc.connectionState ===
        "disconnected" ||
        pc.connectionState ===
        "closed"
      ) {

        removePeer(
          remoteId
        );

      }

    };


  return pc;
}


// ==========================
// CREATE OFFER
// ==========================

async function createOffer(
  remoteId
) {

  if (
    remoteId === myId
  ) {
    return;
  }

  const pc =
    createPeerConnection(
      remoteId
    );

  try {

    const offer =
      await pc.createOffer();

    await pc.setLocalDescription(
      offer
    );

    sendSignal({

      type: "offer",

      to: remoteId,

      offer:
        pc.localDescription

    });

  } catch (error) {

    console.error(
      "Offer error:",
      error
    );

  }
}


// ==========================
// HANDLE OFFER
// ==========================

async function handleOffer(
  data
) {

  const remoteId =
    data.from;

  const pc =
    createPeerConnection(
      remoteId
    );

  try {

    await pc.setRemoteDescription(
      new RTCSessionDescription(
        data.offer
      )
    );

    const answer =
      await pc.createAnswer();

    await pc.setLocalDescription(
      answer
    );

    sendSignal({

      type: "answer",

      to: remoteId,

      answer:
        pc.localDescription

    });

  } catch (error) {

    console.error(
      "Offer handling error:",
      error
    );

  }
}


// ==========================
// HANDLE ANSWER
// ==========================

async function handleAnswer(
  data
) {

  const pc =
    peers.get(
      data.from
    );

  if (!pc) return;

  try {

    await pc.setRemoteDescription(
      new RTCSessionDescription(
        data.answer
      )
    );

  } catch (error) {

    console.error(
      "Answer error:",
      error
    );

  }
}


// ==========================
// HANDLE ICE
// ==========================

async function handleIce(
  data
) {

  const pc =
    peers.get(
      data.from
    );

  if (!pc) return;

  try {

    await pc.addIceCandidate(
      new RTCIceCandidate(
        data.candidate
      )
    );

  } catch (error) {

    console.error(
      "ICE error:",
      error
    );

  }
}


// ==========================
// SEND SIGNAL
// ==========================

function sendSignal(data) {

  if (
    !ws ||
    ws.readyState !==
    WebSocket.OPEN
  ) {
    return;
  }

  ws.send(
    JSON.stringify(data)
  );
}


// ==========================
// SHOW REMOTE VIDEO
// ==========================

function showRemoteVideo(
  remoteId,
  stream
) {

  let box =
    $("remote-" + remoteId);

  if (!box) {

    box =
      document.createElement(
        "div"
      );

    box.className =
      "videoBox";

    box.id =
      "remote-" + remoteId;

    const label =
      document.createElement(
        "span"
      );

    label.textContent =
      "👤 User";

    const video =
      document.createElement(
        "video"
      );

    video.autoplay = true;

    video.playsInline = true;

    video.srcObject =
      stream;

    box.appendChild(label);

    box.appendChild(video);

    $("videos")
      .appendChild(box);

  } else {

    const video =
      box.querySelector("video");

    if (video) {

      video.srcObject =
        stream;

    }

  }
}


// ==========================
// REMOVE PEER
// ==========================

function removePeer(
  remoteId
) {

  const pc =
    peers.get(
      remoteId
    );

  if (pc) {

    pc.close();

    peers.delete(
      remoteId
    );

  }

  const video =
    $("remote-" + remoteId);

  if (video) {

    video.remove();

  }
}


// ==========================
// END CALL
// ==========================

$("endCallBtn").onclick =
  () => {

    for (
      const [id]
      of peers
    ) {

      removePeer(id);

    }

    if (localStream) {

      localStream
        .getTracks()
        .forEach(track =>
          track.stop()
        );

      localStream = null;

      $("localVideo")
        .srcObject = null;

    }

    $("callBtn")
      .textContent =
      "📞 Start Call";

    $("micBtn")
      .textContent =
      "🎤 Mic ON";

    $("cameraBtn")
      .textContent =
      "📷 Camera ON";

  };


// ==========================
// LEAVE ROOM
// ==========================

$("leaveBtn").onclick =
  () => {

    if (localStream) {

      localStream
        .getTracks()
        .forEach(track =>
          track.stop()
        );

    }

    for (
      const [id]
      of peers
    ) {

      removePeer(id);

    }

    if (ws) {
      ws.close();
    }

    location.reload();
  };


// ==========================
// SETTINGS
// ==========================

$("settingsBtn").onclick =
  () => {

    $("settingsPanel")
      .classList
      .remove("hidden");

  };


$("closeSettings").onclick =
  () => {

    $("settingsPanel")
      .classList
      .add("hidden");

  };


$("saveSettings").onclick =
  () => {

    const name =
      $("settingsName")
        .value
        .trim() || "Guest";

    localStorage.setItem(
      "waliinName",
      name
    );

    $("nameInput").value =
      name;

    $("settingsPanel")
      .classList
      .add("hidden");

    alert(
      "✅ Settings olkaa'ame."
    );
  };


// ==========================
// START
// ==========================

connectSocket()
  .catch(() => {});
