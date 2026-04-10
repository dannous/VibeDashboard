import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';

// Floodcubed Firebase Configuration
const firebaseConfig = {
    apiKey: 'AIzaSyAot3EkKB_3_8XhTgKME0EzrxiigjW_lsQ',
    authDomain: 'floodcube.io',
    projectId: 'floodcubed',
    storageBucket: 'floodcubed.firebasestorage.app',
    messagingSenderId: '1034457411225',
    appId: '1:1034457411225:web:d2d08674a2abf7495dd208',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const submitBtn = document.getElementById('submit-btn');
    const errorMsg = document.getElementById('error-msg');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Reset state
        errorMsg.classList.remove('visible');
        submitBtn.classList.add('loading');

        try {
            // Trigger Firebase Google Login popup
            const result = await signInWithPopup(auth, googleProvider);
            
            // Get the JWT token
            const idToken = await result.user.getIdToken();

            // Send token to our backend to establish session
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ idToken })
            });

            const apiResult = await response.json();

            if (response.ok && apiResult.success) {
                // Flash success, then redirect
                submitBtn.style.background = '#10b981'; // Green accent
                submitBtn.style.color = '#fff';
                submitBtn.classList.remove('loading');
                submitBtn.innerHTML = '<span>Access Granted</span>';
                setTimeout(() => {
                    window.location.href = '/index.html';
                }, 500);
            } else {
                // Show error (likely unauthorized email)
                submitBtn.classList.remove('loading');
                errorMsg.textContent = apiResult.error || 'Access denied.';
                errorMsg.classList.add('visible');
                
                // Shake animation for error
                loginForm.style.animation = 'shake 0.4s ease-in-out';
                setTimeout(() => {
                    loginForm.style.animation = '';
                }, 400);

                // Sign out of Firebase so they can try a different account immediately next time
                await auth.signOut();
            }
        } catch (error) {
            console.error('Login error:', error);
            submitBtn.classList.remove('loading');
            
            if (error.code === 'auth/popup-closed-by-user') {
                errorMsg.textContent = 'Sign-in window closed.';
            } else {
                errorMsg.textContent = 'Authentication failed. Please try again.';
            }
            
            errorMsg.classList.add('visible');
        }
    });

    // Add keyframe for shake on the fly
    const style = document.createElement('style');
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-5px); }
            40%, 80% { transform: translateX(5px); }
        }
    `;
    document.head.appendChild(style);
});
