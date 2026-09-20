let ws = null;
let myId = null;
let currentRoom = null;
let myStream = null;

const $ = id => document.getElementById(id);

const nameInput = $("nameInput");
const roomInput = $("roomInput");
const statusText = $("status");

nameInput.value =
  localStorage.getItem("waliinName") || "";

$("settingsName").value = nameInput.value;


function connectSocket() {

  return new Promise((resolve, reject) => {

    const protocol =
      location.protocol === "https:" ? "wss:" : "ws:";

    ws = new WebSocket(
      `${protocol}//${location.host}`
    );

    ws.onopen = () => {
      statusText.textContent = "🟢 Connected";
      resolve();
    };

    ws.onerror = () => {
      statusText.textContent =
        "❌ Connection error";
      reject();
    };

    ws.onclose = () => {
      statusText.textContent =
        "🔴 Connection closed";
    };

    ws.onmessage = event => {

      let data;

      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      handleMessage(data);
    };

  });
}


function handleMessage(data) {

  if (data.type === "error") {
    alert("❌ " + data.message);
    return;
  }

  if (data.type === "joined") {

    myId = data.id;
    currentRoom = data.room;

    $("home").classList.add("hidden");
    $("room").classList.remove("hidden");

    $("roomTitle").textContent =
      "🏠 " + currentRoom;

    $("members").innerHTML = "";

    data.members.forEach(addMember);

    updateMemberCount();

    addMessage(
      "System",
      "Room keessatti milkooftee seente."
    );

    return;
  }


  if (data.type === "user-joined") {

    addMember(data.user);

    addMessage(
      "System",
      `${data.user.name} room seene.`
    );

    return;
  }


  if (data.type === "user-left") {

    const element =
      $("member-" + data.id);

    if (element) {
      element.remove();
    }

    updateMemberCount();

    addMessage(
      "System",
      `${data.name || "User"} room keessaa ba'e.`
    );

    return;
  }


  if (data.type === "chat") {

    addMessage(
      data.name || "Guest",
      data.message
    );

    return;
  }
}


function addMember(user) {

  if ($("member-" + user.id)) {
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
    (user.owner ? " 👑 Admin" : "");

  if (user.owner) {
    div.classList.add("owner");
  }

  $("members").appendChild(div);

  updateMemberCount();
}


function updateMemberCount() {

  $("memberCount").textContent =
    $("members")
      .querySelectorAll(".member")
      .length;
}


$("showCreateBtn").onclick = () => {

  $("createBox")
    .classList.remove("hidden");

  $("joinBox")
    .classList.add("hidden");
};


$("showJoinBtn").onclick = () => {

  $("joinBox")
    .classList.remove("hidden");

  $("createBox")
    .classList.add("hidden");
};


$("createBtn").onclick = async () => {

  const name =
    nameInput.value.trim() || "Guest";

  const roomName =
    $("createRoomName")
      .value.trim();

  const password =
    $("createPassword")
      .value;

  if (!roomName) {
    alert("Maqaa Room galchi.");
    return;
  }

  localStorage.setItem(
    "waliinName",
    name
  );

  try {

    if (!ws ||
        ws.readyState !== WebSocket.OPEN) {
      await connectSocket();
    }

    ws.send(JSON.stringify({
      type: "set-name",
      name
    }));

    ws.send(JSON.stringify({
      type: "create-room",
      room: roomName,
      password
    }));

  } catch {

    alert("Server waliin wal qunnamuun hin danda'amne.");

  }
};


$("joinBtn").onclick = async () => {

  const name =
    nameInput.value.trim() || "Guest";

  const roomName =
    roomInput.value.trim();

  const password =
    $("roomPassword").value;

  if (!roomName) {
    alert("Maqaa Room galchi.");
    return;
  }

  localStorage.setItem(
    "waliinName",
    name
  );

  try {

    if (!ws ||
        ws.readyState !== WebSocket.OPEN) {
      await connectSocket();
    }

    ws.send(JSON.stringify({
      type: "set-name",
      name
    }));

    ws.send(JSON.stringify({
      type: "join",
      room: roomName,
      password
    }));

  } catch {

    alert("Server waliin wal qunnamuun hin danda'amne.");

  }
};


$("sendBtn").onclick =
  sendMessage;


$("messageInput").addEventListener(
  "keydown",
  e => {
    if (e.key === "Enter") {
      sendMessage();
    }
  }
);


function sendMessage() {

  const text =
    $("messageInput")
      .value.trim();

  if (!text) return;

  if (!ws ||
      ws.readyState !== WebSocket.OPEN) {
    alert("Connection hin jiru.");
    return;
  }

  ws.send(JSON.stringify({
    type: "chat",
    message: text
  }));

  addMessage("Ati", text);

  $("messageInput").value = "";
}


function addMessage(name, text) {

  const div =
    document.createElement("div");

  div.className = "message";

  if (name === "System") {
    div.classList.add("system");
  }

  div.textContent =
    `${name}: ${text}`;

  $("messages").appendChild(div);

  $("messages").scrollTop =
    $("messages").scrollHeight;
}


$("leaveBtn").onclick = () => {

  if (myStream) {

    myStream
      .getTracks()
      .forEach(track => track.stop());

  }

  location.reload();
};


$("micBtn").onclick = async () => {

  try {

    if (!myStream) {

      myStream =
        await navigator.mediaDevices
          .getUserMedia({
            audio: true,
            video: false
          });

      alert("🎤 Mic banameera.");

    } else {

      const audio =
        myStream.getAudioTracks()[0];

      if (audio) {
        audio.enabled =
          !audio.enabled;

        alert(
          audio.enabled
            ? "🎤 Mic ON"
            : "🔇 Mic OFF"
        );
      }

    }

  } catch {

    alert(
      "Microphone permission hin kennamne."
    );

  }
};


$("cameraBtn").onclick = async () => {

  try {

    if (!myStream) {

      myStream =
        await navigator.mediaDevices
          .getUserMedia({
            audio: true,
            video: true
          });

    } else {

      const video =
        myStream.getVideoTracks()[0];

      if (!video) {

        const newStream =
          await navigator.mediaDevices
            .getUserMedia({
              video: true
            });

        newStream
          .getVideoTracks()
          .forEach(track => {
            myStream.addTrack(track);
          });

      } else {

        video.enabled =
          !video.enabled;

        alert(
          video.enabled
            ? "📷 Camera ON"
            : "📷 Camera OFF"
        );
      }
    }

    $("localVideo").srcObject =
      myStream;

  } catch {

    alert(
      "Camera permission hin kennamne."
    );

  }
};


$("callBtn").onclick = () => {

  alert(
    "📞 Call system itti aanu keessatti WebRTC guutuun itti dabalama."
  );

};


$("settingsBtn").onclick = () => {

  $("settingsPanel")
    .classList.remove("hidden");

};


$("closeSettings").onclick = () => {

  $("settingsPanel")
    .classList.add("hidden");

};


$("saveSettings").onclick = () => {

  const name =
    $("settingsName")
      .value.trim() || "Guest";

  localStorage.setItem(
    "waliinName",
    name
  );

  nameInput.value = name;

  $("settingsPanel")
    .classList.add("hidden");

  alert("✅ Settings olkaa'ame.");
};


connectSocket().catch(() => {});
