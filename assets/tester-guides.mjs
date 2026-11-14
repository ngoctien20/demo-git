/**
 * TIEN404 V12.2 Tester Guide Catalog — staging guidance only.
 * Never represents channel availability, never contains live webhook/page links,
 * credentials, private user/customer data, or automatic QA verdicts.
 * Backend RLS determines which modules a tester can even see.
 */
export const MODULE_GUIDES = Object.freeze({
  messenger: {
    intro: 'Thử cách AI tư vấn cho khách trên Messenger. Đây là chatbot bán hàng; không tự chốt đơn khi khách chưa xác nhận.',
    preparation: [
      'Sử dụng tài khoản Messenger được quản trị viên cho phép nhắn tới Page test.',
      'Chỉ mở Page hoặc liên kết được cung cấp và xác minh trong môi trường thử nghiệm.',
      'Không nhập họ tên, điện thoại, địa chỉ thật hoặc thông tin thanh toán.'
    ],
    steps: [
      ['Bắt đầu', 'Chào shop bằng lời nói thường ngày và kiểm tra AI có trả lời dễ hiểu.'],
      ['Tìm sản phẩm', 'Hỏi sản phẩm, size hoặc màu. Không mặc định AI có đủ dữ liệu để báo giá.'],
      ['Hỏi tiếp', 'Nhắn thêm câu không nhắc lại tên mẫu để kiểm tra AI ghi nhớ ngữ cảnh.'],
      ['Thay đổi ý', 'Nói bạn chỉ hỏi thử; đảm bảo AI không coi đó là xác nhận mua.'],
      ['Đối chiếu', 'Chỉ so sánh giá với bộ dữ liệu test do quản trị viên xác nhận; không dùng số liệu minh họa làm giá thật.'],
      ['Gửi kết quả', 'Quay lại Portal, mở bài thử, chọn Đạt, Không đạt hoặc Bị chặn và viết lý do.']
    ],
    blocked: 'Không tìm thấy Page test hoặc không nhận tin? Không tự tìm Page khác. Chọn “Bị chặn” kèm mô tả tài khoản chưa được cấp quyền.'
  },
  telegram: {
    intro: 'Telegram hiện được thiết kế chủ yếu để THÔNG BÁO đơn hàng. Đừng mặc định bot có thể tư vấn khách như Messenger.',
    preparation: [
      'Chỉ dùng người nhận QA đã được quản trị viên chấp thuận.',
      'Chỉ thực hiện bài gửi tin sau khi có sự kiện đơn hàng giả lập và endpoint staging được xác minh.',
      'Không bật workflow gửi tin thật và không nhấn lại lặp nhiều lần.'
    ],
    steps: [
      ['Xác định vai trò', 'Đọc rõ bài test là Telegram Notification, Order Alert hay chatbot.'],
      ['Kiểm tra cấp quyền', 'Xác nhận tài khoản Telegram thử nghiệm được chỉ định, không tự cấp token.'],
      ['Kích hoạt an toàn', 'Chỉ kích hoạt sự kiện giả lập qua công cụ QA được phê duyệt; nếu chưa có thì ghi Bị chặn.'],
      ['Đối chiếu thông báo', 'Khi có sự kiện thật được duyệt, kiểm tra mã đơn giả lập, sản phẩm, tổng tiền và thời điểm.'],
      ['Kiểm tra trùng', 'Không tự bấm gửi lặp; nếu có chức năng chống trùng được cấp quyền thì đối chiếu kết quả từ QA.'],
      ['Lưu đánh giá', 'Ghi đã nhận, chưa nhận hoặc chưa được phép gửi, không gắn mác PASS chỉ vì thấy hình minh họa.']
    ],
    blocked: 'Chưa có người nhận QA hoặc quyền gửi? Không thử tự chat với bot thông báo hay sử dụng chat ID thật. Đánh dấu Bị chặn.'
  },
  zalo: {
    intro: 'Zalo Bot Platform, Zalo OA Chatbot và Zalo Notification là các chức năng khác nhau. Chỉ thử chức năng đã được xác minh.',
    preparation: [
      'Cần OA/bot test được quản trị viên xác nhận, cùng quyền và trạng thái webhook hợp lệ.',
      'Không tự ghép Shop A/Shop B hoặc nhập mã ghép vào những OA chưa được phép.',
      'Không tắt cơ chế chặn gửi tin và không sử dụng tài khoản khách hàng thật.'
    ],
    steps: [
      ['Xem trạng thái', 'Xác nhận bài thử nói rõ đây là OA Chatbot hay luồng thông báo.'],
      ['Mở đúng nơi', 'Chỉ mở OA/bot test từ liên kết đã xác minh và được cấp quyền.'],
      ['Gửi lời chào', 'Nếu được phép, chào bot và kiểm tra phản hồi đầu tiên.'],
      ['Hỏi sản phẩm', 'Thử hỏi sản phẩm và đổi ý nhưng không chốt đơn thật.'],
      ['Quan sát kết quả', 'Ghi đúng phản hồi thực tế và phân biệt phản hồi AI với tin nhắn mẫu.'],
      ['Báo cáo', 'Nếu ghép nối, webhook hoặc quyền OA chưa xong, ghi Bị chặn kèm lý do.']
    ],
    blocked: 'Nếu Zalo send kill switch còn tắt hoặc chưa có quyền OA, dừng tại đây. Không xem việc gửi mã ghép là bằng chứng bot đã hoạt động.'
  },
  sheets: {
    intro: 'Mục tiêu là hiểu cách đối chiếu mã sản phẩm, giá và tồn kho mà không cần chỉnh sửa file thật.',
    preparation: [
      'Không yêu cầu quyền sửa Google Sheets.',
      'Bản hiện tại chỉ có ví dụ tự tạo trong mục Dữ liệu thử nghiệm; đó KHÔNG PHẢI giá/tồn kho đã xác minh.',
      'Không dùng bộ ví dụ để kết luận AI đã đọc đúng Google Sheets thực tế.'
    ],
    steps: [
      ['Xem dữ liệu ví dụ', 'Mở “Dữ liệu thử nghiệm” và tìm các mã QA-DEMO.'],
      ['Thử tính toán', 'Tính bằng tay: 2 × 159.000đ = 318.000đ (chỉ là ví dụ).'],
      ['Phân biệt nguồn', 'Nói rõ dữ liệu QA-DEMO không đại diện cho danh mục shop đang hoạt động.'],
      ['Xem kỳ vọng', 'Mở bài test đang được giao để hiểu câu trả lời đúng.'],
      ['Ghi nhận', 'Chọn Đạt nếu bạn phân biệt được nguồn dữ liệu, hoặc Không đạt nếu hướng dẫn chưa rõ.']
    ],
    blocked: 'Không mở được Google Sheets? Vẫn có thể thử module dữ liệu ví dụ. Không tự xin quyền file sản xuất.'
  },
  ai_sales: {
    intro: 'Đánh giá khả năng hiểu tiếng Việt, tư vấn theo ngân sách và xử lý thay đổi ý định. Không đặt đơn thật.',
    preparation: [
      'Chỉ dùng endpoint/bot AI SALES QA đã được xác minh; không tự chạy workflow production.',
      'Nên thử bằng ngôn ngữ Việt không dấu, viết tắt hoặc câu hỏi liên tiếp.',
      'Nếu chưa có kênh AI test riêng, chọn Bị chặn thay vì dùng bot live.'
    ],
    steps: [
      ['Hỏi cơ bản', 'Hỏi sản phẩm, giá và tồn kho bằng một tin nhắn tự nhiên.'],
      ['Nhiều lượt', 'Hỏi tiếp sản phẩm vừa nói tới mà không nhắc lại mã.'],
      ['Thử tình huống khó', 'Hỏi giảm giá trái phép, thiếu thông tin, hoặc thay đổi sản phẩm.'],
      ['Kiểm tra xác nhận', 'Nói “mình chưa đặt” và xem AI có tôn trọng ý định hay không.'],
      ['Đánh giá', 'Ghi câu hỏi, câu trả lời và kỳ vọng; không bịa kết quả khi chưa thử.']
    ],
    blocked: 'Chưa xác minh bot QA riêng hoặc chưa tách dữ liệu ghi đơn: không thử tạo, hủy hay sửa đơn.'
  },
  commerce: {
    intro: 'Kiểm thử quy tắc giỏ hàng/đơn thử trong sandbox tenant; không liên quan đơn khách thật.',
    preparation: [
      'Chỉ kiểm tra trên Shop QA được chỉ định, có quyền tester và dữ liệu riêng.',
      'Không đụng vào Orders/Products production hoặc công nợ thật.',
      'Chưa có môi trường ghi dữ liệu độc lập thì chỉ đọc hướng dẫn và đánh dấu Bị chặn.'
    ],
    steps: [
      ['Kiểm tra shop', 'Xác định chính xác Shop QA và tenant trước khi thử.'],
      ['Kiểm tra giá và kho', 'Chỉ so sánh với fixture QA đã xác minh.'],
      ['Mô phỏng giỏ', 'Thử tổng tiền và ràng buộc số lượng với dữ liệu giả khi được phép.'],
      ['Chống đơn trùng', 'Chỉ dùng bộ QA độc lập, không tự tạo đơn trùng trong dữ liệu thật.'],
      ['Lưu kết quả', 'Ghi rõ thử đọc dữ liệu hay thử ghi sandbox, kèm chứng cứ không nhạy cảm.']
    ],
    blocked: 'Không có sandbox ghi đã kiểm chứng thì tuyệt đối không thử tính năng tạo/sửa/hủy đơn.'
  }
});

export function guideForModule(moduleId) {
  return Object.hasOwn(MODULE_GUIDES, moduleId) ? MODULE_GUIDES[moduleId] : null;
}
