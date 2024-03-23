// This is an authed page.

import {
    USER_DATA,
    loadUserEntitlements,
    accessToPremiumAnalytics,
    canCreateDynamicCodes,
} from "./entitlement.js";
import { toast } from "./toast.js";
import { events, eventProperties, trackEvent } from "./analytics.js";

document.onload = await loadUserEntitlements();

const upgradeButton = document.getElementById("upgrade");
upgradeButton.style.display = "";

const creationName = document.getElementById("creationName");
const creationUrl = document.getElementById("creationUrl");
const creationSubmit = document.getElementById("creationSubmit");
const creationSubmitLink = document.getElementById("creationSubmitLink");
const message = document.querySelector("#message");
const dynamicToggle = document.getElementById("dynamicToggle");

creationUrl.addEventListener("input", function () {
    if (this.value.trim() !== "") {
        this.classList.add("has-content");
    } else {
        this.classList.remove("has-content");
    }
});

creationUrl.addEventListener("focus", function () {
    document.getElementById("urlHint").classList.add("show");
});

creationUrl.addEventListener("blur", function () {
    document.getElementById("urlHint").classList.remove("show");
});

creationName.addEventListener("focus", function () {
    document.getElementById("nameHint").classList.add("show");
});

creationName.addEventListener("blur", function () {
    document.getElementById("nameHint").classList.remove("show");
});

creationSubmit.addEventListener("click", async (event) => {
    event.preventDefault();
    const redirect_url = creationUrl.value;
    const name = creationName.value;

    if (redirect_url === "") {
        return (message.innerText = "Please enter a redirect URL.");
    }
    if (name === "") {
        return (message.innerText = "Please enter a name.");
    }
    if (!redirect_url.startsWith("http")) {
        return (message.innerText = "Please enter a valid URL.");
    }

    await createCode("qr", name, redirect_url);
});

creationSubmitLink.addEventListener("click", async (event) => {
    event.preventDefault();
    const redirect_url = creationUrl.value;
    const name = creationName.value;

    if (redirect_url === "") {
        return (message.innerText = "Please enter a redirect URL.");
    }
    if (name === "") {
        return (message.innerText = "Please enter a name.");
    }
    if (!redirect_url.startsWith("http")) {
        return (message.innerText = "Please enter a valid URL.");
    }

    await createCode("link", name, redirect_url);
});

async function createCode(type, name, redirect_url) {
    const response = await fetch("/api/post/createcode/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            redirect_url: redirect_url,
            name: name,
            type: type,
            isDynamic: dynamicToggle.checked,
        }),
    });
    const data = await response.json();
    if (data.status === "ok") {
        loadCodes();
        trackEvent(events.createCode, {
            [eventProperties.type]: type,
            [eventProperties.isDynamic]: data.isDynamic,
        });
    }
    if (data.message) {
        toast(data.message, true);
    }
}

async function loadCodes() {
    const codesList = document.getElementById("codesList");
    codesList.innerHTML = "Loading your codes...";

    const codesResponse = await fetch("/api/get/codes", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });
    const codesData = await codesResponse.json();

    if (codesData.status == "ok") {
        codesList.innerHTML = "";
        generateCodes(codesData.data);
    }
}

async function generateCodes(codes) {
    const codesContainer = document.getElementsByClassName("codes")[0];
    const codesList = document.getElementById("codesList");
    for (const code of codes) {
        const codeDiv = document.createElement("div");
        codeDiv.classList.add("code", "roundedBox");
        codeDiv.id = code._id;
        codeDiv.dataset.url = code.redirect_url;

        const name = document.createElement("h3");
        name.innerText = code.name;
        name.classList.add("codeName");

        const visits = document.createElement("p");
        visits.innerText = `Scans: ${code.visits}`;
        visits.classList.add("codeVisits");

        const buttons = document.createElement("div");
        buttons.classList.add("codeButtons");

        const deleteButton = document.createElement("button");
        deleteButton.classList.add("btn", "btn-danger", "deleteButton");
        deleteButton.innerText = "Delete";
        deleteButton.addEventListener("click", async (event) => {
            if (!confirm("Are you sure you want to delete this code?")) {
                return;
            }
            event.preventDefault();
            const response = await fetch("/api/post/deletecode/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id: code._id,
                }),
            });
            const data = await response.json();
            if (data.status === "ok") {
                document.getElementById(code._id).remove();
                trackEvent(events.deleteCode, {
                    [eventProperties.type]: code.type,
                });
            }
        });
        buttons.appendChild(deleteButton);

        const copyLinkButton = document.createElement("button");
        copyLinkButton.classList.add("btn", "copyButton");
        copyLinkButton.innerText = "Copy Link";
        const currentBaseURL = window.location.href.split("/")[2];
        copyLinkButton.addEventListener("click", async (event) => {
            event.preventDefault();
            let url;
            if (code.type == "qr") {
                url = `${currentBaseURL}/code?id=${code._id}`;
            } else {
                url = url = `${currentBaseURL}/link/${code.short_id}`;
            }
            navigator.clipboard.writeText(url);
            copyLinkButton.innerText = "Copied!";
            setTimeout(() => {
                copyLinkButton.innerText = "Copy Link";
            }, 2000);
            trackEvent(events.copyCodeLink, {
                [eventProperties.type]: code.type,
            });
        });
        buttons.appendChild(copyLinkButton);

        if ((USER_DATA.plan > 0 && code.isDynamic) || true) {
            const updateLinkButton = document.createElement("button");
            updateLinkButton.classList.add(
                "btn",
                "btn-primary",
                "updateButton"
            );
            updateLinkButton.innerText = "Update link";
            updateLinkButton.dataset.id = code._id;
            updateLinkButton.addEventListener("click", async (event) => {
                event.preventDefault();
                const newURL = prompt("Enter a new URL:");
                if (
                    newURL === null ||
                    newURL === "" ||
                    newURL === code.redirect_url ||
                    !newURL.startsWith("http")
                ) {
                    return;
                }
                const response = await fetch("/api/post/updatecode/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        id: updateLinkButton.dataset.id,
                        newURL: newURL,
                    }),
                });
                const data = await response.json();
                if (data.status === "ok") {
                    loadCodes();
                    trackEvent(events.updateCodeLink, {
                        [eventProperties.type]: code.type,
                    });
                } else {
                    toast(data.data, true);
                }
            });
            buttons.appendChild(updateLinkButton);
        }

        codeDiv.appendChild(name);
        codeDiv.appendChild(visits);
        codeDiv.appendChild(buttons);

        if (code.type === "qr") {
            const QRcode = document.createElement("img");
            QRcode.src = code.code;
            QRcode.classList.add("card-img-top");
            QRcode.addEventListener("click", async () => {});
            QRcode.classList.add("card-img-top");
            const pngImg = await fetch(code.code);
            const pngBlob = await pngImg.blob();
            const qrCodeImageFile = new File([pngBlob], "qr.png", {
                type: "image/png",
            });
            QRcode.addEventListener("click", async () => {
                const url = window.URL.createObjectURL(qrCodeImageFile);
                const a = document.createElement("a");
                a.href = url;
                a.download = "qualitycodesQR.png";
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
                trackEvent(events.downloadQR, {
                    [eventProperties.type]: code.type,
                });
            });
            codeDiv.appendChild(QRcode);
        }

        codesList.appendChild(codeDiv);
    }
}

loadCodes();

dynamicToggle.addEventListener("click", async (event) => {
    const value = dynamicToggle.checked;
    if (value) {
        trackEvent(events.toggleDynamic, {});
        if (!canCreateDynamicCodes()) {
            toast(
                "You have reached your dynamic code limit. Upgrade to create more.",
                true
            );
            dynamicToggle.checked = false;
            return;
        }
    }
});

const searchCodes = document.getElementById("searchCodes");
searchCodes.addEventListener("input", async (event) => {
    const query = searchCodes.value;

    const codesByName = document.getElementsByClassName("codeName");
    // dataset url
    const codesByURL = document.getElementsByClassName("code");

    for (const code of codesByName) {
        if (code.innerText.toLowerCase().includes(query.toLowerCase())) {
            code.parentElement.style.display = "";
        } else {
            code.parentElement.style.display = "none";
        }
    }

    for (const code of codesByURL) {
        if (code.dataset.url.toLowerCase().includes(query.toLowerCase())) {
            code.style.display = "";
        } else {
            code.style.display = "none";
        }
    }
});
