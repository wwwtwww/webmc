/**
 * HelpOverlay.js
 * 负责创建和管理游戏操作指南浮层
 */
export function initHelpOverlay() {
  // 1. 创建遮罩层容器
  const overlay = document.createElement('div');
  overlay.id = 'help-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: '9999',
    display: 'none', // 默认隐藏
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none', // 允许点击穿透，或者设为 'auto' 并配合点击关闭
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif'
  });

  // 2. 创建内容面板
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    backgroundColor: '#222',
    padding: '30px 50px',
    borderRadius: '15px',
    border: '2px solid #444',
    boxShadow: '0 0 20px rgba(255, 255, 255, 0.2)',
    color: '#fff',
    textAlign: 'center'
  });

  // 3. 填充内容
  panel.innerHTML = `
    <h1 style="margin-top: 0; color: #00ffcc; text-shadow: 0 0 10px #00ffcc; font-size: 28px;">🎮 操作指南</h1>
    <table style="width: 100%; border-spacing: 0 10px; font-size: 18px; text-align: left;">
      <tr><td style="color: #aaa; padding-right: 20px;">[W, A, S, D]</td><td>移动</td></tr>
      <tr><td style="color: #aaa; padding-right: 20px;">[空格 Space]</td><td>跳跃</td></tr>
      <tr><td style="color: #aaa; padding-right: 20px;">[鼠标左键]</td><td>破坏方块 / 攻击生物</td></tr>
      <tr><td style="color: #aaa; padding-right: 20px;">[鼠标右键]</td><td>放置方块</td></tr>
      <tr><td style="color: #aaa; padding-right: 20px;">[E / Tab]</td><td>打开/关闭 背包</td></tr>
      <tr><td style="color: #aaa; padding-right: 20px;">[T / \`]</td><td>打开开发者控制台</td></tr>
      <tr><td style="color: #aaa; padding-right: 20px;">[F]</td><td>开启/关闭飞行模式</td></tr>
      <tr><td style="color: #aaa; padding-right: 20px;">[H]</td><td>显示/隐藏本指南</td></tr>
    </table>
    <p style="margin-bottom: 0; margin-top: 20px; color: #666; font-size: 14px;">提示：再次按下 [H] 键回到游戏</p>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // 4. 绑定快捷键 H
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'h') {
      const isHidden = overlay.style.display === 'none';
      overlay.style.display = isHidden ? 'flex' : 'none';
    }
  });

  console.log('[UI] Help Overlay initialized. Press "H" to toggle.');
}
