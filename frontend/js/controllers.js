const UI = {
    showError: function(inputName, message, form) {
        const input = form.querySelector(`[name="${inputName}"]`);
        if (!input) return;
        
        input.classList.add('error');
        const group = input.closest('.form-group');
        if (!group) return;

        let errorSpan = group.querySelector('.form-error');
        if (!errorSpan) {
            errorSpan = document.createElement('span');
            errorSpan.className = 'form-error';
            group.appendChild(errorSpan);
        }
        errorSpan.innerText = message;
        errorSpan.style.display = 'block';
        errorSpan.style.marginTop = '4px';
    },
    clearErrors: function(form) {
        form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        form.querySelectorAll('.form-error').forEach(el => el.style.display = 'none');
    }
};

const AuthController = {
    initLogin: function() {
        const form = document.getElementById('login-form');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            UI.clearErrors(form);
            
            if (!form.email.value) { UI.showError('email', 'Phone number or email is required', form); return; }
            if (!form.password.value) { UI.showError('password', 'Password is required', form); return; }

            const payload = {
                email: form.email.value,
                password: form.password.value
            };
            
            const res = await API.post('/login', payload);
            if (res && res.success) {
                Auth.setToken(res.data.token);
                Auth.setHasProfile(res.data.has_profile);
                if (res.data.has_profile) {
                    Router.navigate('/dashboard');
                } else {
                    Router.navigate('/profile/edit');
                }
            } else {
                if (res && res.data && res.data.needs_verification) {
                    localStorage.setItem('verify_user_id', res.data.user_id);
                    Router.navigate('/verify');
                } else {
                    // Unified style: show backend error on the first field (email)
                    UI.showError('email', res ? res.message : 'Invalid email or password', form);
                }
            }
        });
    },

    initRegister: function() {
        const form = document.getElementById('register-form');
        if (!form) return;
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            Auth.clearAll();
            UI.clearErrors(form);

            if (!form.first_name.value) { UI.showError('first_name', 'First name is required', form); return; }
            if (!form.last_name.value) { UI.showError('last_name', 'Last name is required', form); return; }
            if (!form.email.value || !form.email.value.includes('@')) { UI.showError('email', 'Invalid email address', form); return; }
            const mobileVal = form.mobile.value.trim();
            const mobileRegex = /^01[0125][0-9]{8}$/;
            if (!mobileRegex.test(mobileVal)) { 
                UI.showError('mobile', 'Enter a valid 11-digit Egyptian mobile (e.g. 01012345678)', form); 
                return; 
            }
            if (!form.password.value || form.password.value.length < 8) { UI.showError('password', 'Password must be at least 8 chars', form); return; }

            const payload = {
                first_name: form.first_name.value,
                last_name: form.last_name.value,
                mobile: form.mobile.value,
                email: form.email.value,
                password: form.password.value
            };
            
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerText = 'Registering...';

            const res = await API.post('/register', payload);
            if (res && res.success) {
                localStorage.setItem('verify_user_id', res.data.user_id);
                console.log("TEST CODES:", res.data);
                // Friendly modal/notification could go here, but for now alert is fine for flow
                Router.navigate('/verify');
            } else {
                const msg = (res && res.message) ? res.message.toLowerCase() : '';
                if (msg.includes('email')) UI.showError('email', res.message, form);
                else if (msg.includes('mobile')) UI.showError('mobile', res.message, form);
                else Toast.show(res ? res.message : 'Registration failed');
                
                btn.disabled = false;
                btn.innerText = 'Continue →';
            }
        });
    },

    initVerify: function() {
        const smsForm = document.getElementById('verify-sms-form');
        const continueBtn = document.getElementById('btn-complete-verify');
        const userId = localStorage.getItem('verify_user_id');

        let isEmailVerified = false;
        let isPhoneVerified = false;

        const updateUI = () => {
            const emailBadge = document.getElementById('email-status-badge');
            const smsBadge = document.getElementById('sms-status-badge');
            const emailMsg = document.getElementById('email-verified-msg');

            if (isEmailVerified && emailBadge) {
                emailBadge.innerText = 'Verified';
                emailBadge.className = 'badge badge-green';
                if (emailMsg) emailMsg.style.display = 'block';
            }
            if (isPhoneVerified && smsBadge) {
                smsBadge.innerText = 'Verified';
                smsBadge.className = 'badge badge-green';
                if (smsForm) {
                    smsForm.querySelector('button').disabled = true;
                    smsForm.querySelector('button').innerText = '✓ Verified';
                }
            }

            if (isEmailVerified && isPhoneVerified && continueBtn) {
                continueBtn.disabled = false;
                continueBtn.style.opacity = '1';
                
                // Auto-advance so they don't get stuck verifying again
                setTimeout(() => {
                    if (Auth.hasProfile()) {
                        Router.navigate('/dashboard');
                    } else {
                        Router.navigate('/profile/edit');
                    }
                }, 1500);
            }
        };

        const checkStatus = async () => {
             const res = await API.post('/check-verification', { user_id: userId });
             if (res && res.success) {
                 isEmailVerified = !!res.data.email_verified;
                 isPhoneVerified = !!res.data.phone_verified;
                 if (res.data.token) {
                     Auth.setToken(res.data.token);
                 }
                 if (res.data.fully_verified || (isEmailVerified && isPhoneVerified)) {
                    Auth.setHasProfile(res.data.has_profile);
                 }
                 updateUI();
             }
        };

        if (!userId) {
            if (Auth.isAuthenticated()) { Router.navigate('/dashboard'); return; }
            Router.navigate('/login'); return;
        }

        // Check status immediately and then every 3s
        checkStatus();
        const poll = setInterval(() => {
            if (isEmailVerified && isPhoneVerified) {
                clearInterval(poll);
                return;
            }
            // Only poll if the page is still the verify page
            if (!document.getElementById('verify-sms-form')) {
                clearInterval(poll);
                return;
            }
            checkStatus();
        }, 3000);

        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                if (!continueBtn.disabled) {
                    Router.navigate('/profile/edit');
                }
            });
        }

        if (smsForm) {
            smsForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const code = smsForm.code.value;
                const res = await API.post('/verify-otp', { user_id: userId, code });
                if (res && res.success) {
                    isPhoneVerified = true;
                    if (res.data.token) {
                        Auth.setToken(res.data.token);
                    }
                    if (res.data.fully_verified) {
                        Auth.setHasProfile(res.data.has_profile);
                    }
                    updateUI();
                } else {
                    Toast.show(res ? res.message : 'Invalid code');
                }
            });
        }

        window._verifyState = {
            setEmailVerified: (val) => {
                isEmailVerified = val;
                updateUI();
            }
        };
    },

    handleEmailLink: async function() {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        
        if (!token) {
            Toast.show('Invalid verification link.');
            Router.navigate('/login');
            return;
        }

        const res = await API.post('/verify-email-link', { token });
        if (res && res.success) {
            if (res.data.token) {
                Auth.setToken(res.data.token);
            }
            if (res.data.fully_verified) {
                Auth.setHasProfile(res.data.has_profile);
            }
            const badge = document.getElementById('email-status-badge');
            const msg = document.getElementById('email-verified-msg');
            if (badge) {
                badge.innerText = 'Verified';
                badge.className = 'badge badge-green';
            }
            if (msg) msg.style.display = 'block';

            if (window._verifyState) {
                window._verifyState.setEmailVerified(true);
            }
            
            Toast.show('Email verified successfully! Now please complete the WhatsApp step.', 'success');
        } else {
            Toast.show(res ? res.message : 'Verification link expired or invalid.');
            Router.navigate('/login');
        }
    },

    initForgotPassword: function() {
        const form = document.getElementById('forgot-form');
        if(!form) return;
        
        form.addEventListener('submit', async(e) => {
            e.preventDefault();
            const payload = { email: form.email.value };
            const res = await API.post('/forgot-password', payload);
            if(res && res.success) {
                Toast.show(res.message, 'success');
                if (res.data && res.data.test_reset_token) {
                    console.log('RESET TOKEN (DEV ONLY): ', res.data.test_reset_token);
                    // store for easy testing flow
                    localStorage.setItem('test_reset_token', res.data.test_reset_token);
                }
                Router.navigate('/login');
            } else {
                Toast.show(res && res.message ? res.message : 'Error processing request.');
            }
        });
    },

    initResetPassword: function() {
        const form = document.getElementById('reset-form');
        if(!form) return;

        // Auto-fill test token or URL token if available
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        const testToken = localStorage.getItem('test_reset_token');
        
        if (urlToken && form.token) {
            form.token.value = urlToken;
        } else if (testToken && form.token) {
            form.token.value = testToken;
            localStorage.removeItem('test_reset_token');
        }

        form.addEventListener('submit', async(e) => {
            e.preventDefault();
            const pt = form.password.value;
            const pc = form.password_confirm.value;
            if (pt !== pc) {
                Toast.show('Passwords do not match');
                return;
            }
            
            const payload = { token: form.token.value, new_password: pt };
            const res = await API.post('/reset-password', payload);
            Toast.show(res ? res.message : 'Error resetting password');
            if (res && res.success){
                Router.navigate('/login');
            }
        });
    }
};

const ProfileController = {
    initEdit: function() {
        const form = document.getElementById('profile-form');
        if (!form) return;

        // Populate days
        const daySelect = form.dob_day;
        for (let i = 1; i <= 31; i++) {
            const val = i.toString().padStart(2, '0');
            daySelect.options.add(new Option(i, val));
        }

        // Populate years (1950 - 2018)
        const yearSelect = form.dob_year;
        const currentYear = new Date().getFullYear();
        for (let i = currentYear - 6; i >= 1950; i--) {
            yearSelect.options.add(new Option(i, i));
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            UI.clearErrors(form);

            if (!form.dob_day.value) { UI.showError('dob_day', 'Select day', form); return; }
            if (!form.dob_month.value) { UI.showError('dob_month', 'Select month', form); return; }
            if (!form.dob_year.value) { UI.showError('dob_year', 'Select year', form); return; }
            if (!form.gender.value) { UI.showError('gender', 'Please select gender', form); return; }
            if (!form.playing_hand.value) { UI.showError('playing_hand', 'Please select playing hand', form); return; }

            const dob = `${form.dob_year.value}-${form.dob_month.value}-${form.dob_day.value}`;

            const payload = {
                date_of_birth: dob,
                gender: form.gender.value,
                playing_hand: form.playing_hand.value,
                nickname: form.nickname.value,
                location: form.location.value,
                bio: form.bio.value
            };
            
            const res = await API.post('/profile/update', payload);
            if (res && res.success) {
                Auth.setHasProfile(true);
                Router.navigate('/dashboard');
            } else {
                Toast.show(res ? res.message : 'Failed to save profile');
            }
        });
    }
};
