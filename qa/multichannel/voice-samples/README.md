# Mẫu tin nhắn thoại thử (giọng máy espeak-ng, tiếng Việt, OGG Opus như Telegram)

| File | Câu nói | Kỳ vọng |
|---|---|---|
| s1.ogg | "Giá a không không ba bao nhiêu vậy shop" | hiểu A003, hỏi giá → trả mẫu A003 (fast path) |
| s2.ogg | "Cho mình mua bê không không hai, hai cái nhé" | hiểu B002, muốn mua 2 → chuyển AI kèm gợi ý mã + số lượng |
| s3.ogg | "Quần jean nam dưới bốn trăm nghìn có mẫu nào không shop" | không có mã → chuyển nguyên câu cho AI tư vấn |
| s4.ogg | tiếng ồn 2 giây | không nghe rõ → hỏi lại khách, không gọi AI bán hàng |

Giọng máy khó nghe hơn giọng người thật, nên đây là phép thử khắt khe. Tạo lại: `espeak-ng -v vi -s 140 -w x.wav "<câu>" && ffmpeg -i x.wav -c:a libopus -b:a 24k x.ogg`.
