const status = document.querySelector<HTMLElement>('#app-status');

if (status === null) {
  throw new Error('起動状態を表示する要素が見つかりません。');
}

status.textContent = 'オフラインで動作しています';
