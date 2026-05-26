import requests


def send_telegram_message(bot_token: str, chat_id: str, message: str):

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"

    payload = {
        "chat_id": str(chat_id),
        "text": message,
        "parse_mode": "HTML"
    }

    try:
        response = requests.post(
            url,
            json=payload,
            timeout=15
        )

        print("TELEGRAM STATUS:", response.status_code)
        print("TELEGRAM RESPONSE:", response.text)

        return response.status_code == 200

    except Exception as e:
        print("TELEGRAM ERROR:", str(e))
        return False