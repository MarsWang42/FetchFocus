export const nudgeStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :host {
    all: initial;
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 2147483647;
    pointer-events: none;
    font-family: 'Inter', system-ui, sans-serif;
  }

  .overlay {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 320px;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    pointer-events: auto;
    transform: translateX(400px);
    opacity: 0;
    animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes slideIn {
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }

  .overlay.closing {
    animation: slideOut 0.3s ease-in forwards;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 20px 20px 16px;
  }

  .close-btn {
    position: absolute;
    top: 16px;
    right: 16px;
    width: 28px;
    height: 28px;
    border: none;
    background: rgba(0, 0, 0, 0.05);
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    transition: all 0.2s;
    z-index: 10;
    pointer-events: auto;
  }

  .close-btn:hover {
    background: rgba(0, 0, 0, 0.1);
    color: #1e293b;
  }

  .content {
    padding: 16px 20px;
  }

  .footer {
    padding: 16px 20px 20px;
    display: flex;
    gap: 10px;
  }

  .btn {
    flex: 1;
    height: 44px;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .btn-primary {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
  }

  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
  }

  .btn-secondary {
    background: transparent;
    color: #64748b;
    border: 1px solid #e2e8f0;
  }

  .btn-secondary:hover {
    background: #f1f5f9;
    color: #475569;
    border-color: #cbd5e1;
  }

  /* Puppy animation styles */
  .puppy-container {
    position: relative;
    width: 100%;
    height: 120px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .puppy {
    position: absolute;
    right: -150px;
    bottom: 0;
    width: 120px;
    height: auto;
    animation: puppyRunIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }

  @keyframes puppyRunIn {
    0% {
      right: -150px;
      transform: translateY(0);
    }
    15% {
      transform: translateY(-15px) rotate(-5deg);
    }
    30% {
      transform: translateY(0) rotate(0deg);
    }
    45% {
      transform: translateY(-12px) rotate(-3deg);
    }
    60% {
      transform: translateY(0) rotate(0deg);
    }
    75% {
      transform: translateY(-8px) rotate(-2deg);
    }
    100% {
      right: calc(50% - 60px);
      transform: translateY(0) rotate(0deg);
    }
  }

  .overlay.closing .puppy {
    animation: puppyRunOut 0.4s ease-in forwards;
  }

  @keyframes puppyRunOut {
    0% {
      right: calc(50% - 60px);
      transform: translateY(0);
    }
    25% {
      transform: translateY(-10px);
    }
    50% {
      transform: translateY(0);
    }
    75% {
      transform: translateY(-8px);
    }
    100% {
      right: -150px;
      transform: translateY(0);
    }
  }

  .puppy-speech {
    text-align: center;
    font-size: 18px;
    font-weight: 600;
    color: #1e293b;
    line-height: 1.4;
    animation: fadeIn 0.3s ease 0.5s forwards;
    opacity: 0;
  }

  @keyframes fadeIn {
    to {
      opacity: 1;
    }
  }

  .puppy-subtitle {
    text-align: center;
    font-size: 13px;
    color: #64748b;
    margin-top: 4px;
    animation: fadeIn 0.3s ease 0.6s forwards;
    opacity: 0;
    padding: 0px 20px;
  }

  .puppy-speech-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .nudge-reason-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
    cursor: help;
    transition: color 0.2s;
    animation: fadeIn 0.3s ease 0.5s forwards;
    opacity: 0;
  }

  .nudge-reason-container:hover {
    color: #64748b;
  }

  .nudge-tooltip {
    visibility: hidden;
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 8px;
    padding: 8px 12px;
    background-color: #f59e0b;
    color: #fff;
    font-size: 12px;
    font-weight: 500;
    white-space: normal;
    min-width: 200px;
    max-width: 280px;
    text-align: center;
    border-radius: 8px;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
    opacity: 0;
    transition: opacity 0.15s;
    pointer-events: none;
  }

  .nudge-tooltip::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #f59e0b transparent transparent transparent;
  }

  .nudge-reason-container:hover .nudge-tooltip {
    visibility: visible;
    opacity: 1;
  }

  /* Focus reminder styles */
  .focus-reminder {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 14px 16px;
    background: #f8fafc;
    border-radius: 10px;
  }

  .focus-favicon {
    width: 20px;
    height: 20px;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .focus-favicon-placeholder {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
  }

  .focus-name {
    font-size: 14px;
    font-weight: 500;
    color: #1e293b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;
