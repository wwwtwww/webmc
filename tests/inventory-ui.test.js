import { InventoryManager } from '../InventoryManager.js';
import { InventoryUI } from '../InventoryUI.js';

describe('InventoryUI', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="inventory-ui" style="display:none"></div>
      <div id="main-inventory"></div>
      <div id="hotbar-inventory"></div>
      <div id="crafting-grid">
        <div class="inv-slot" data-type="craft" data-index="0"></div>
        <div class="inv-slot" data-type="craft" data-index="1"></div>
        <div class="inv-slot" data-type="craft" data-index="2"></div>
        <div class="inv-slot" data-type="craft" data-index="3"></div>
      </div>
      <div id="crafting-result"></div>
    `;
  });

  it('renders inventory contents into matching slots', () => {
    const blockData = {
      4: { name: '木头', color: '#663300' },
    };
    const inventory = new InventoryManager(36);
    inventory.addItem(4, 12);

    const ui = new InventoryUI(blockData);
    ui.render(inventory);

    expect(document.querySelector('#hotbar-inventory .inv-slot[data-index="0"]').textContent).toContain('12');
  });

  it('toggles visibility state', () => {
    const ui = new InventoryUI({});

    expect(ui.isOpen()).toBe(false);
    expect(ui.toggle()).toBe(true);
    expect(ui.isOpen()).toBe(true);
    expect(ui.toggle()).toBe(false);
  });
});
