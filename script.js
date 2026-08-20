// Double Trouble Studios — site logic
const SUPA_URL = "https://imkmjbmuboeqpydkygjx.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlta21qYm11Ym9lcXB5ZGt5Z2p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNTczODMsImV4cCI6MjEwMjczMzM4M30.SD6YAcUrlHY83XnQPbQhibWpsH91_0_1IDrBAZ9znd8";

const db = supabase.createClient(SUPA_URL, SUPA_KEY);

async function loadGames() {
  const grid = document.getElementById("game-grid");
  if (!grid) return;

  const { data, error } = await db.from("games").select("*").order("id");

  if (error || !data || data.length === 0) {
    grid.innerHTML = `<div class="grid-empty">New games in development — subscribe below to hear about them first.</div>`;
    return;
  }

  grid.innerHTML = data.map(g => `
    <article class="card">
      <img src="${g.image_url || ""}" alt="${g.title}">
      <div class="card-body">
        <h3>${g.title}</h3>
        <p>${g.description || ""}</p>
      </div>
    </article>
  `).join("");
}

const form = document.getElementById("sub-form");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailInput = document.getElementById("sub-email");
    const status = document.getElementById("sub-status");
    const btn = document.getElementById("sub-btn");
    const email = emailInput.value.trim().toLowerCase();

    status.className = "sub-status";
    if (!email || !email.includes("@") || !email.includes(".")) {
      status.textContent = "Please enter a valid email address.";
      status.classList.add("err");
      return;
    }

    btn.disabled = true;
    status.textContent = "Subscribing...";

    const token = crypto.randomUUID();
    const { error } = await db.from("subscribers")
      .insert([{ email, confirm_token: token, confirmed: false }]);

    btn.disabled = false;

    if (error) {
      if (error.code === "23505") {
        status.textContent = "This email is already subscribed.";
      } else {
        status.textContent = "Something went wrong — please try again.";
        console.error(error);
      }
      status.classList.add("err");
      return;
    }

    status.textContent = "Almost done! Check your inbox and click the confirmation link.";
    status.classList.add("ok");
    emailInput.value = "";
  });
}

loadGames();
