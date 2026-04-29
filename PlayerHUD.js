/**
 * PlayerHUD.js
 * 负责动态创建和更新屏幕左上角的玩家状态栏
 */

let hpBarElement = null;

export function initHUD() {
  // 1. 创建外部容器
  const hudContainer = document.createElement('div');
  hudContainer.id = 'player-hud';
  Object.assign(hudContainer.style, {
    position: 'absolute',
    top: '20px',
    left: '20px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: '10px 16px',
    borderRadius: '4px', // 微微的圆角
    zIndex: '1000', // 确保在最上层
    pointerEvents: 'none', // 不阻挡鼠标点击
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: '150px'
  });

  // 2. 创建玩家名字文本
  const nameLabel = document.createElement('div');
  nameLabel.innerText = 'YILE';
  Object.assign(nameLabel.style, {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: 'bold',
    fontFamily: 'monospace, sans-serif', // 硬朗的字体
    textShadow: '2px 2px 0 #000', // 硬朗的阴影
    letterSpacing: '2px'
  });

  // 3. 创建血条外槽 (背景)
  const hpBarContainer = document.createElement('div');
  Object.assign(hpBarContainer.style, {
    width: '100%',
    height: '12px',
    backgroundColor: 'rgba(50, 50, 50, 0.8)',
    border: '2px solid #000', // 黑色边框增加立体感
    position: 'relative'
  });

  // 4. 创建绿色血条内层
  hpBarElement = document.createElement('div');
  Object.assign(hpBarElement.style, {
    width: '100%',
    height: '100%',
    backgroundColor: '#2ecc71', // 经典的血条绿
    transition: 'width 0.2s ease-out' // 掉血时有平滑动画
  });

  // 组装 DOM 树
  hpBarContainer.appendChild(hpBarElement);
  hudContainer.appendChild(nameLabel);
  hudContainer.appendChild(hpBarContainer);

  // 挂载到 body
  document.body.appendChild(hudContainer);
}

/**
 * 预留的更新血量接口
 * @param {number} currentHp 当前血量
 * @param {number} maxHp 最大血量
 */
export function updateHUDHealth(currentHp, maxHp) {
  if (hpBarElement) {
    const percentage = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
    hpBarElement.style.width = `${percentage}%`;
    
    // 如果血量太低，可以将颜色变为红色预警
    if (percentage <= 25) {
      hpBarElement.style.backgroundColor = '#e74c3c';
    } else {
      hpBarElement.style.backgroundColor = '#2ecc71';
    }
  }
}
