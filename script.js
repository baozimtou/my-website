document.addEventListener('DOMContentLoaded', () => {
  const view = document.getElementById('view');
  if (view) {
    view.innerHTML = '<h1>诊断脚本已成功加载并执行。</h1><p>如果看到此消息，说明部署流程正常，问题出在之前的复杂脚本中。</p>';
    view.style.color = 'green';
    view.style.textAlign = 'center';
    view.style.padding = '2rem';
  } else {
    // 如果连 view 元素都找不到，就在控制台报错
    console.error('关键诊断失败：在 DOM 中找不到 ID 为 "view" 的元素。');
    // 并在 body 处显示消息
    document.body.innerHTML = '<h1>关键诊断失败：HTML 结构不完整。</h1>';
  }
});