// IOS PROXY - Client Portal v1.0.1 (Last Updated: 2026-06-12)
// Disable all console logs to prevent inspection
if (typeof window !== 'undefined') {
    window.console = {
        log: () => {},
        error: () => {},
        warn: () => {},
        info: () => {},
        debug: () => {}
    };
}

const { useState, useEffect, useRef } = React;

// Premium custom SweetAlert2 popup wrapper
const showSwalAlert = (title, text, icon = 'info') => {
    let iconColor = 'var(--primary)';
    if (icon === 'error') iconColor = 'var(--danger)';
    if (icon === 'success') iconColor = 'var(--success)';
    if (icon === 'warning') iconColor = 'var(--warning)';

    Swal.fire({
        title: title,
        text: text,
        icon: icon,
        iconColor: iconColor,
        background: '#0a122a',
        color: '#fff',
        confirmButtonText: 'Acknowledge',
        customClass: {
            popup: 'cyber-swal-popup',
            title: 'cyber-swal-title',
            htmlContainer: 'cyber-swal-html',
            confirmButton: 'cyber-swal-confirm-btn'
        },
        buttonsStyling: false
    });
};

function App() {
    const [activeTab, setActiveTab] = useState('home');
    const [udid, setUdid] = useState('');
    const [key, setKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState({ show: false, message: '' });
    
    // Step indicator & Session states
    const [step, setStep] = useState(1);
    const [session, setSession] = useState('');
    const [showAnn, setShowAnn] = useState(false);

    // Verification result states
    const [verifiedData, setVerifiedData] = useState(null);
    const [countdown, setCountdown] = useState({ days: '00', hours: '00', minutes: '00', seconds: '00' });
    
    const timerRef = useRef(null);

    // Parse URL parameters on load
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const udidParam = urlParams.get('udid');
        if (udidParam) {
            setUdid(udidParam.trim());
            showToast('Retrieved device ID (UDID) successfully!');
        }

        // Restore tab state if saved
        const savedTab = localStorage.getItem('active_tab_revised_v4');
        if (savedTab && ['home', 'tutorial', 'contact'].includes(savedTab)) {
            setActiveTab(savedTab);
        }
    }, []);

    // Countdown active timer effect
    useEffect(() => {
        if (verifiedData && verifiedData.expiry_timestamp) {
            // Clear existing timer
            if (timerRef.current) clearInterval(timerRef.current);

            const targetTime = verifiedData.expiry_timestamp;

            const updateTimer = () => {
                const now = new Date().getTime();
                const difference = targetTime - now;

                if (difference <= 0) {
                    clearInterval(timerRef.current);
                    setCountdown({ days: '00', hours: '00', minutes: '00', seconds: '00' });
                    return;
                }

                const d = Math.floor(difference / (1000 * 60 * 60 * 24));
                const h = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const m = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((difference % (1000 * 60)) / 1000);

                setCountdown({
                    days: String(d).padStart(2, '0'),
                    hours: String(h).padStart(2, '0'),
                    minutes: String(m).padStart(2, '0'),
                    seconds: String(s).padStart(2, '0')
                });
            };

            // Run immediately and start interval
            updateTimer();
            timerRef.current = setInterval(updateTimer, 1000);
        } else if (verifiedData && verifiedData.countdown) {
            // Fallback to static countdown values from backend
            setCountdown({
                days: verifiedData.countdown.days || '00',
                hours: verifiedData.countdown.hours || '00',
                minutes: verifiedData.countdown.minutes || '00',
                seconds: verifiedData.countdown.seconds || '00'
            });
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [verifiedData]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        localStorage.setItem('active_tab_revised_v4', tabId);
    };

    const showToast = (msg) => {
        setToast({ show: true, message: msg });
        setTimeout(() => {
            setToast({ show: false, message: '' });
        }, 3000);
    };

    const handleGetUDID = () => {
        // iOS Safari detection
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

        if (!isIOS) {
            showSwalAlert(
                "Device Mismatch",
                "Sorry, automatic retrieval is only supported on iOS devices (iPhone, iPad).",
                "warning"
            );
            return;
        }

        if (!isSafari) {
            showSwalAlert(
                "Safari Required",
                "Please open this website in Safari on your iPhone to download the profile and retrieve your UDID correctly.",
                "warning"
            );
            return;
        }

        window.location.href = '/extract.php';
    };

    const handleCopyUDID = () => {
        if (!udid) return;
        
        if (navigator.clipboard) {
            navigator.clipboard.writeText(udid)
                .then(() => showToast('UDID copied to clipboard!'))
                .catch(() => fallbackCopy(udid));
        } else {
            fallbackCopy(udid);
        }
    };

    const fallbackCopy = (text) => {
        const tempText = document.createElement('textarea');
        tempText.value = text;
        document.body.appendChild(tempText);
        tempText.select();
        try {
            document.execCommand('copy');
            showToast('UDID copied to clipboard!');
        } catch (err) {
            showToast('Copy failed.');
        }
        document.body.removeChild(tempText);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!udid || !key) return;

        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ udid, key })
            });

            const data = await response.json();

            if (data.success) {
                if (data.step === 2) {
                    setStep(2);
                    setSession(data.session);
                    setVerifiedData(data.details);
                    showToast('Retrieving details, pending confirmation...');
                } else if (data.step === 3) {
                    setStep(3);
                    setVerifiedData(data);
                    if (data.dashboard && data.dashboard.announcement) {
                        setShowAnn(true);
                    }
                    showToast('Activation completed successfully!');
                }
            } else {
                setError(data.message || 'Verification failed.');
            }
        } catch (err) {
            // Verification failure handled silently
            setError('Failed to connect to the server. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!session) return;

        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/confirm', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ session })
            });

            const data = await response.json();

            if (data.success) {
                setStep(3);
                setVerifiedData(data);
                if (data.dashboard && data.dashboard.announcement) {
                    setShowAnn(true);
                }
                showToast('Confirmed and logged in successfully!');
            } else {
                setError(data.message || 'Confirmation failed.');
            }
        } catch (err) {
            // Confirmation failure handled silently
            setError('Connection failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setStep(1);
        setSession('');
        setShowAnn(false);
        setVerifiedData(null);
        setError('');
        setKey('');
    };

    return (
        <div className="main-container">
            <div className="premium-card animate__animated animate__fadeInUp">
                
                {/* Brand Header */}
                <div className="text-center mb-4">
                    <h1 className="brand-title">IOS PROXY</h1>
                    <span className="card-header-badge">
                        <i className="bi bi-shield-lock-fill me-2"></i> SECURED NODE CLIENT
                    </span>
                </div>

                {/* Tab Switcher Navigation */}
                <div className="cyber-tabs-nav">
                    <button 
                        className={`cyber-tab-btn ${activeTab === 'home' ? 'active' : ''}`}
                        onClick={() => handleTabChange('home')}
                    >
                        <i className={`bi bi-shield-lock${activeTab === 'home' ? '-fill' : ''}`}></i>
                        <span>Dashboard</span>
                    </button>
                    <button 
                        className={`cyber-tab-btn ${activeTab === 'tutorial' ? 'active' : ''}`}
                        onClick={() => handleTabChange('tutorial')}
                    >
                        <i className={`bi bi-play-circle${activeTab === 'tutorial' ? '-fill' : ''}`}></i>
                        <span>Tutorials</span>
                    </button>
                    <button 
                        className={`cyber-tab-btn ${activeTab === 'contact' ? 'active' : ''}`}
                        onClick={() => handleTabChange('contact')}
                    >
                        <i className={`bi bi-chat-dots${activeTab === 'contact' ? '-fill' : ''}`}></i>
                        <span>Contact Support</span>
                    </button>
                </div>

                {/* Tab Content 1: Dashboard / Home */}
                {activeTab === 'home' && (
                    <div className="animate__animated animate__fadeIn">
                        
                        {/* Display error message if registration failed */}
                        {error && (
                            <div className="warning-card mb-4 border-danger" style={{ background: 'rgba(255, 42, 109, 0.08)' }}>
                                <i className="bi bi-x-circle-fill text-danger fs-4"></i>
                                <div className="warning-text">
                                    <b className="text-danger">Error:</b> {error}
                                </div>
                            </div>
                        )}

                        {step === 1 && (
                            /* Step 1: Registration Form */
                            <form onSubmit={handleSubmit} autoComplete="off">
                                
                                {/* UDID Field Pod */}
                                <div className="cyber-input-group">
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <span className="info-label fw-bold text-white small">Device ID (UDID)</span>
                                        <span className={`cyber-status-tag ${udid ? 'success' : 'waiting'}`}>
                                            <span className="pulse-dot"></span>
                                            <span className="status-text">{udid ? 'UDID Retrieved ✓' : 'Awaiting UDID'}</span>
                                        </span>
                                    </div>
                                    
                                    <div className="position-relative">
                                        <input 
                                            type="text" 
                                            value={udid} 
                                            onChange={(e) => setUdid(e.target.value)}
                                            className="cyber-input" 
                                            placeholder="Enter UDID or retrieve automatically" 
                                            required 
                                        />
                                        <div className="input-icon-left"><i className="bi bi-fingerprint"></i></div>
                                        {udid && (
                                            <div className="input-actions-inside">
                                                <button 
                                                    type="button" 
                                                    onClick={handleCopyUDID}
                                                    className="btn-action-icon" 
                                                    title="Copy UDID"
                                                >
                                                    <i className="bi bi-copy"></i>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="mt-3">
                                        <button 
                                            type="button" 
                                            onClick={handleGetUDID} 
                                            className="btn-action-pill w-100 fw-bold"
                                        >
                                            Get UDID
                                        </button>
                                    </div>
                                </div>

                                {/* License Key Pod */}
                                <div className="cyber-input-group">
                                    <div className="d-flex align-items-center gap-3 mb-3">
                                        <div style={{
                                            width: '38px', height: '38px', 
                                            background: 'linear-gradient(135deg, var(--primary), var(--secondary))', 
                                            borderRadius: '12px', display: 'flex', 
                                            alignItems: 'center', justifyContent: 'center', 
                                            boxShadow: '0 0 12px rgba(0,168,255,0.3)'
                                        }}>
                                            <i className="bi bi-key-fill text-white fs-5"></i>
                                        </div>
                                        <div>
                                            <div className="small fw-bold text-white">License Entry Key</div>
                                            <div className="text-primary-glow" style={{ fontSize: '0.68rem', letterSpacing: '0.5px', color: 'rgba(0,168,255,0.7)' }}>LICENSE KEY ACTIVATION</div>
                                        </div>
                                    </div>
                                    <div className="position-relative">
                                        <input 
                                            type="text" 
                                            value={key}
                                            onChange={(e) => setKey(e.target.value)}
                                            className="cyber-input text-center text-uppercase font-monospace" 
                                            style={{ letterSpacing: '2px', fontSize: '1rem', padding: '16px 20px' }}
                                            placeholder="PROX-XXXX-XXXX" 
                                            required 
                                        />
                                    </div>
                                </div>
                                
                                {/* Verify Submit Button */}
                                <button 
                                    type="submit" 
                                    disabled={loading} 
                                    className="btn-premium-glow mt-3"
                                >
                                    {loading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            <span>Activating System...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Activate Client Node</span>
                                            <i className="bi bi-lightning-charge-fill animate-pulse"></i>
                                        </>
                                    )}
                                </button>
                                
                                {/* Browser Warning Banner */}
                                <div className="warning-card">
                                    <i className="bi bi-exclamation-triangle-fill"></i>
                                    <div className="warning-text">
                                        <b>Browser Compatibility Warning:</b> You must open this page in <b>Safari</b>. Dynamic profile configuration retrieval and UDID autofill are not supported on other browsers.
                                    </div>
                                </div>

                                {/* Step Guidelines */}
                                <div className="instruction-card mt-4">
                                    <div className="instruction-title mb-3">
                                        <i className="bi bi-info-circle-fill text-primary me-2"></i> iOS Device Registration Workflow
                                    </div>
                                    <div className="timeline-cyber mt-3">
                                        <div className="timeline-item">
                                            <span className="timeline-step-badge">STEP 1</span>
                                            <div className="timeline-desc">Launch this portal inside the default <b>Safari</b> browser on your iPhone or iPad.</div>
                                        </div>
                                        <div className="timeline-item">
                                            <span className="timeline-step-badge">STEP 2</span>
                                            <div className="timeline-desc">Press <b>"Get UDID"</b> and confirm to download the provisioning configuration profile.</div>
                                        </div>
                                        <div className="timeline-item">
                                            <span className="timeline-step-badge">STEP 3</span>
                                            <div className="timeline-desc">Navigate to iPhone <b>Settings</b> &rarr; tap on the <b>"Profile Downloaded"</b> menu to install the profile.</div>
                                        </div>
                                        <div className="timeline-item">
                                            <span className="timeline-step-badge">STEP 4</span>
                                            <div className="timeline-desc">You will automatically redirect back with your <b>UDID</b> populated. Enter your <b>License Key</b> and activate!</div>
                                        </div>
                                    </div>
                                </div>

                            </form>
                        )}

                        {step === 2 && verifiedData && (
                            /* Step 2: Confirmation Screen */
                            <div className="animate__animated animate__fadeIn text-center py-2">
                                <div className="mb-4">
                                    <div style={{
                                        width: '60px', height: '60px', fontSize: '2rem',
                                        margin: '0 auto', background: 'rgba(0,168,255,0.08)',
                                        color: 'var(--primary)', borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 0 15px rgba(0, 168, 255, 0.15)'
                                    }}>
                                        <i className="bi bi-link-45deg"></i>
                                    </div>
                                    <h4 className="mt-3 fw-bold text-white">Confirm License Registration</h4>
                                    <p className="text-white-50 small">Please review the details and confirm node activation</p>
                                </div>
                                
                                <div className="neon-tech-panel text-start mb-4">
                                    <div className="mb-3">
                                        <label className="info-label text-warning small fw-bold mb-1">
                                            <i className="bi bi-key-fill me-1"></i> License Key
                                        </label>
                                        <div className="font-monospace text-white fw-bold px-3 py-2 bg-dark bg-opacity-35 rounded-3 border border-warning border-opacity-10" style={{ wordBreak: 'break-all' }}>
                                            {verifiedData.key}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="info-label text-info small fw-bold mb-1">
                                            <i className="bi bi-globe2 me-1"></i> Your Registered IP Address
                                        </label>
                                        <div className="font-monospace text-info fw-bold px-3 py-2 bg-dark bg-opacity-35 rounded-3 border border-info border-opacity-10">
                                            {verifiedData.ip}
                                        </div>
                                    </div>
                                </div>
                                
                                <button 
                                    type="button" 
                                    onClick={handleConfirm}
                                    disabled={loading}
                                    className="btn-premium-glow mb-3"
                                >
                                    {loading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Confirm Details & Activate</span>
                                            <i className="bi bi-check-circle-fill"></i>
                                        </>
                                    )}
                                </button>
                                
                                <button 
                                    type="button" 
                                    onClick={handleReset}
                                    className="btn-action-pill w-100 fw-bold justify-content-center text-white-50"
                                    style={{ border: '1px solid rgba(255, 255, 255, 0.1)', background: 'transparent' }}
                                >
                                    <i className="bi bi-arrow-left"></i> Back to Verification
                                </button>
                            </div>
                        )}

                        {step === 3 && verifiedData && (
                            /* Step 3: Success Screen */
                            <div className="animate__animated animate__zoomIn text-center">
                                
                                {/* Success Glowing Shield */}
                                <div className="success-glowing-shield mb-3">
                                    <div className="shield-halo-1"></div>
                                    <div className="shield-halo-2"></div>
                                    <i className="bi bi-shield-check"></i>
                                </div>

                                <h4 className="fw-bold text-shadow-glow text-success mb-2">Activation Successful</h4>
                                  <p className="text-white-50 small mb-4">Device successfully connected to IOS PROXY node cluster</p>

                                {/* Premium Expiry Countdown Card */}
                                <div className="premium-countdown-card mb-4">
                                    <div className="countdown-hdr">REMAINING ACTIVATION TIME</div>
                                    <div className="countdown-grid">
                                        <div className="cd-item">
                                            <span className="cd-val">{countdown.days}</span>
                                            <span className="cd-lbl">Days</span>
                                        </div>
                                        <div className="cd-item">
                                            <span className="cd-val">{countdown.hours}</span>
                                            <span className="cd-lbl">Hrs</span>
                                        </div>
                                        <div className="cd-item">
                                            <span className="cd-val">{countdown.minutes}</span>
                                            <span className="cd-lbl">Mins</span>
                                        </div>
                                        <div className="cd-item">
                                            <span className="cd-val">{countdown.seconds}</span>
                                            <span className="cd-lbl">Secs</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Tech Details Panel */}
                                <div className="neon-tech-panel text-start mb-4">
                                    <div className="small fw-bold text-white mb-3 text-uppercase" style={{ letterSpacing: '1px' }}>
                                        <i className="bi bi-cpu text-primary me-2"></i> Device & Connection Status
                                    </div>
                                    {verifiedData.device_info && verifiedData.device_info.length > 0 ? (
                                        verifiedData.device_info.map((item, idx) => (
                                            <div className="tech-row" key={idx}>
                                                <span className="tech-lbl">{item.label}</span>
                                                <span className={`tech-val ${item.value.toLowerCase().includes('active') || item.value.toLowerCase().includes('success') || item.value.toLowerCase().includes('secured') ? 'success' : ''}`}>
                                                    {item.value}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <>
                                            <div className="tech-row">
                                                <span className="tech-lbl">Device ID (UDID)</span>
                                                <span className="tech-val">{udid}</span>
                                            </div>
                                            <div className="tech-row">
                                                <span className="tech-lbl">Activation Status</span>
                                                <span className="tech-val success">Active</span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* SSL Certificate download card */}
                                {verifiedData.dashboard && verifiedData.dashboard.ssl_href && (
                                    <div className="card-box text-start mb-4 p-4 rounded-4" style={{ background: 'rgba(3, 7, 18, 0.45)', border: '1px solid rgba(0, 168, 255, 0.15)' }}>
                                        <div className="d-flex align-items-center mb-3">
                                            <div style={{
                                                width: '38px', height: '38px', background: '#0044cc',
                                                borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 4px 12px rgba(0, 68, 204, 0.4)'
                                            }}>
                                                <i className="bi bi-file-earmark-lock2 text-white fs-5"></i>
                                            </div>
                                            <h6 className="mb-0 ms-3 fw-bold text-white fs-5">SSL Certificate Authority (PEM)</h6>
                                        </div>
                                        <p className="text-white-50 small mb-3" style={{ lineHeight: '1.5' }}>
                                            Please download and install the SSL Root CA profile onto your device to establish secure proxy authentication.
                                        </p>
                                        <a 
                                            href="/downloads/parkin.pem" 
                                            className="btn-action-pill w-100 fw-bold justify-content-center text-white" 
                                            style={{ background: 'linear-gradient(135deg, #0044cc 0%, #002288 100%)', border: 'none', padding: '12px' }} 
                                            download
                                        >
                                            <i className="bi bi-cloud-download me-2"></i> Download SSL CA Profile
                                        </a>
                                    </div>
                                )}

                                {/* Proxy Nodes List */}
                                {verifiedData.dashboard && verifiedData.dashboard.nodes && verifiedData.dashboard.nodes.length > 0 && (
                                    <div className="mt-4 mb-4 text-start">
                                        <div className="d-flex align-items-center mb-3">
                                            <div style={{
                                                width: '38px', height: '38px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                                                borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 4px 12px rgba(0, 168, 255, 0.3)'
                                            }}>
                                                <i className="bi bi-hdd-network text-white fs-5"></i>
                                            </div>
                                            <h6 className="mb-0 ms-3 fw-bold text-white fs-5">Proxy Nodes List</h6>
                                        </div>

                                        <div className="d-flex flex-column gap-3">
                                            {verifiedData.dashboard.nodes.map((node, index) => (
                                                <div 
                                                    key={index} 
                                                    className="node-box p-3 rounded-4"
                                                >
                                                    <div className="d-flex justify-content-between align-items-center mb-3">
                                                        <span className="fw-bold text-white" style={{ letterSpacing: '0.5px' }}>{node.name}</span>
                                                        <span className={`cyber-status-tag ${node.status === 'ONLINE' ? 'success' : 'waiting'}`} style={{ fontSize: '0.62rem', padding: '2px 7px' }}>
                                                            <span className="pulse-dot"></span>
                                                            <span className="status-text">{node.status}</span>
                                                        </span>
                                                    </div>

                                                    <div 
                                                        className="detail-item d-flex justify-content-between align-items-center px-3 py-2 rounded-3 mb-2"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(node.host);
                                                            showToast(`Server Host copied!`);
                                                        }}
                                                    >
                                                        <div className="d-flex flex-column">
                                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>SERVER HOST</span>
                                                            <span className="font-monospace text-white small" style={{ fontSize: '0.85rem' }}>{node.host}</span>
                                                        </div>
                                                        <i className="bi bi-copy text-white-50 small"></i>
                                                    </div>

                                                    <div 
                                                        className="detail-item d-flex justify-content-between align-items-center px-3 py-2 rounded-3"
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(node.port);
                                                            showToast(`Port copied!`);
                                                        }}
                                                    >
                                                        <div className="d-flex flex-column">
                                                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>PORT</span>
                                                            <span className="font-monospace text-white small" style={{ fontSize: '0.85rem' }}>{node.port}</span>
                                                        </div>
                                                        <i className="bi bi-copy text-white-50 small"></i>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Reset back button */}
                                <button 
                                    type="button" 
                                    onClick={handleReset} 
                                    className="btn-action-pill w-100 fw-bold justify-content-center text-white-50 mb-3"
                                    style={{ border: '1px solid rgba(255, 255, 255, 0.1)', background: 'transparent' }}
                                >
                                    <i className="bi bi-arrow-left"></i> Return to Activation Form
                                </button>

                            </div>
                        )}
                                   {/* Announcement Modal Popup */}
                        {showAnn && verifiedData && verifiedData.dashboard && verifiedData.dashboard.announcement && (
                            <div className="announcement-overlay">
                                <div className="announcement-content-card animate__animated animate__zoomIn">
                                    <div className="announcement-icon-wrapper">
                                        <i className="bi bi-megaphone-fill"></i>
                                    </div>
                                    {verifiedData.dashboard.announcement.image && (
                                        <div className="announcement-img-wrapper">
                                            <img 
                                                src={verifiedData.dashboard.announcement.image} 
                                                className="announcement-img"
                                                alt="announcement"
                                            />
                                        </div>
                                    )}
                                    <h5 className="fw-bold text-white mb-2">{verifiedData.dashboard.announcement.title || 'IOS PROXY'}</h5>
                                    <p className="text-white-50 small mb-4" style={{ lineHeight: '1.6' }}>
                                        {verifiedData.dashboard.announcement.desc || 'Thank you for choosing us.'}
                                    </p>
                                    <button 
                                        onClick={() => setShowAnn(false)}
                                        className="btn-premium-glow py-2 rounded-3 text-white fw-bold small"
                                        style={{ fontSize: '0.85rem' }}
                                    >
                                        Acknowledge and Continue
                                    </button>
                                </div>
                            </div>
                        )}
                        
                    </div>
                )}

                {/* Tab Content 2: Tutorials */}
                {activeTab === 'tutorial' && (
                    <div className="animate__animated animate__fadeIn">
                        
                        <div className="mb-4">
                            <label className="info-label mb-3 fw-bold small text-white">
                                <i className="bi bi-play-circle-fill me-2 text-primary"></i> Video tutorial on UDID and configuration setup
                            </label>
                            
                            {/* YouTube Video Embed */}
                            <div className="video-cyber-card">
                                <div style={{
                                    position: 'relative',
                                    paddingBottom: '56.25%',
                                    height: 0,
                                    overflow: 'hidden',
                                    borderRadius: '12px',
                                    background: '#000'
                                }}>
                                    <iframe
                                        src="https://www.youtube.com/embed/uhT28PXWyR8"
                                        title="Setup Tutorial Video"
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            border: 'none'
                                        }}
                                    />
                                </div>
                                <div className="video-info">
                                    <h6>Setup & Configuration Tutorial</h6>
                                    <p className="text-white-50">Watch the step-by-step guide on how to configure your device and connect to the proxy network.</p>
                                </div>
                            </div>
                        </div>

                    </div>
                )}

                {/* Tab Content 3: Contact Us / Support */}
                {activeTab === 'contact' && (
                    <div className="animate__animated animate__fadeIn">
                        
                        {/* Support Title Header */}
                        <div className="text-center mb-4">
                            <div style={{
                                width: '60px', height: '60px', fontSize: '1.8rem', 
                                margin: '0 auto', background: 'rgba(0,168,255,0.08)', 
                                color: 'var(--primary)', borderRadius: '50%', 
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 0 15px rgba(0, 168, 255, 0.15)'
                            }}>
                                <i className="bi bi-headset animate-pulse"></i>
                            </div>
                            <h5 className="fw-bold mt-3 mb-1 text-white">Customer Support & Assistance Team</h5>
                            <p className="text-white-50 small">Have questions? Key not working? Need device changes/resets? Reach out anytime!</p>
                        </div>

                        {/* Contact List */}
                        <div className="mb-4">
                            <a 
                                href="https://discord.gg/Hug9NYX8Gv" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="contact-cyber-card discord-card"
                            >
                                <div className="contact-icon"><i className="bi bi-discord"></i></div>
                                <div className="contact-details">
                                    <div className="d-flex align-items-center">
                                        <h6 className="mb-0">Discord Community</h6>
                                        <span className="contact-tag-badge">
                                            <span className="pulse-dot bg-success me-1" style={{ width: '4px', height: '4px', display: 'inline-block', borderRadius: '50%' }}></span> 
                                            Active Members
                                        </span>
                                    </div>
                                    <p className="small text-white-50 mt-1">Discuss configurations, tips, updates, and chat with other users.</p>
                                </div>
                                <div className="contact-arrow"><i className="bi bi-chevron-right"></i></div>
                            </a>
                        </div>

                        {/* Schedule Operating Hours */}
                        <div className="operating-hours-box">
                            <div className="d-flex align-items-center gap-2 mb-2 text-warning">
                                <i className="bi bi-clock-fill"></i>
                                <span className="fw-bold small text-uppercase" style={{ letterSpacing: '0.5px', fontSize: '0.7rem' }}>Support Operating Hours</span>
                            </div>
                            <p className="mb-0 text-white-50 small" style={{ lineHeight: '1.55' }}>
                                Available: <strong>24/7 Everyday</strong><br />
                                * Support administrators will resolve tickets as quickly as possible.
                            </p>
                        </div>

                    </div>
                )}

            </div>

            {/* Floating Toasts Alert Notifier */}
            <div className={`toast-cyber ${toast.show ? 'show' : ''}`}>
                <i className="bi bi-check-circle-fill text-success fs-5"></i>
                <span>{toast.message}</span>
            </div>
        </div>
    );
}

// Mount the React Application
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
