document.addEventListener("DOMContentLoaded", function () {
    // ✅ Pre-fill email if "Remember Me" was used
    const savedEmail = localStorage.getItem("rememberEmail");
    const isChecked = localStorage.getItem("rememberChecked") === "true";
    const emailInput = document.getElementById("login-email");
    const rememberCheckbox = document.getElementById("login-check");

    if (savedEmail && isChecked && emailInput && rememberCheckbox) {
        emailInput.value = savedEmail;
        rememberCheckbox.checked = true;
    }

    // ✅ Sign up function
    const registerButton = document.querySelector("#register .submit");
    if (registerButton) {
        registerButton.addEventListener("click", async function (e) {
            e.preventDefault();

            const firstname = document.getElementById("register-firstname").value;
            const lastname = document.getElementById("register-lastname").value;
            const email = document.getElementById("register-email").value;
            const password = document.getElementById("register-password").value;

            try {
                const response = await fetch("http://localhost:5000/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ firstname, lastname, email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    alert("Registration successful! You can now log in.");
                    window.location.href = "index.html";
                } else {
                    alert(data.message);
                }
            } catch (error) {
                alert("Error registering. Please try again.");
                console.error("Register Error:", error);
            }
        });
    }

    // ✅ Login function
    const loginButton = document.querySelector("#login .submit");
    if (loginButton) {
        loginButton.addEventListener("click", async function (e) {
            e.preventDefault();

            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-password").value;
            const rememberMe = document.getElementById("login-check").checked;

            try {
                const response = await fetch("http://localhost:5000/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    alert("Login successful!");

                    // ✅ Store token & user info
                    localStorage.setItem("token", data.token);
                    localStorage.setItem("user", JSON.stringify(data.user));

                    // ✅ Save or clear remembered email
                    if (rememberMe) {
                        localStorage.setItem("rememberEmail", email);
                        localStorage.setItem("rememberChecked", "true");
                    } else {
                        localStorage.removeItem("rememberEmail");
                        localStorage.removeItem("rememberChecked");
                    }

                    window.location.href = "dashboard.html";
                } else {
                    alert(data.message);
                }
            } catch (error) {
                alert("Error logging in. Please try again.");
                console.error("Login Error:", error);
            }
        });
    }

    // ✅ Logout function
    function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        alert("Logged out successfully!");
        window.location.href = "index.html";
    }

    // ✅ Attach logout button listener
    const logoutButton = document.querySelector(".logout-btn");
    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }
});
