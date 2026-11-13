// A shop can start in trial with the dashboard alone. Grant/activate only in a server flow.
export function onboardingSteps(state) {
  const complete = value => value === true ? 'Đã xác minh' : 'Chưa xác minh';
  return [
    ['Tài khoản và cửa hàng',complete(state.membershipVerified)],
    ['Nhập danh mục sản phẩm',complete(state.catalogVerified)],
    ['Kênh bán hàng',state.messengerVerified ? 'Messenger đã xác minh' :
      state.websiteVerified ? 'Website Chat đã xác minh' : 'Chờ kết nối Messenger hoặc Website Chat'],
    ['Thông báo đơn hàng',state.dashboardAvailable ? 'Dùng hộp thư trong Dashboard' : 'Chờ xác minh hộp thư'],
    ['Kiểm thử bot',complete(state.botTestPassed)],
    ['Zalo OA','Tùy chọn · Có thể bỏ qua']
  ];
}
export function mountOnboarding(root, state) {
  const section=document.createElement('section'), title=document.createElement('h2'),list=document.createElement('ol');
  title.textContent='Bắt đầu sử dụng cửa hàng';
  for(const [name,status] of onboardingSteps(state)){
    const li=document.createElement('li');li.textContent=name+' · '+status;list.append(li);
  }
  section.append(title,list);root.append(section);return ()=>section.remove();
}
