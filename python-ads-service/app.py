from flask import Flask, request, jsonify
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException
import os
from dotenv import load_dotenv

# Load .env file from the parent directory
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=dotenv_path)

app = Flask(__name__)

LANGUAGE_MAP = {
    'de': '1001',  # German
    'en': '1000',  # English
    'fr': '1002',  # French
    'it': '1004',  # Italian
    'es': '1003',  # Spanish
    'nl': '1010',  # Dutch
    'pt': '1014',  # Portuguese
    'pl': '1025',  # Polish
    'ru': '1031',  # Russian
    'ja': '1005',  # Japanese
    'zh': '1017',  # Chinese
}

DEFAULT_COUNTRY = '2756'
DEFAULT_LANGUAGE = 'de'


def sanitize_customer_id(customer_id):
    if not customer_id:
        return None
    return str(customer_id).replace('-', '')


def build_credentials(overrides=None):
    credentials = {
        "developer_token": os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN"),
        "client_id": os.getenv("GOOGLE_ADS_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_ADS_CLIENT_SECRET"),
        "refresh_token": os.getenv("GOOGLE_ADS_REFRESH_TOKEN"),
        "login_customer_id": os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID"),
        "use_proto_plus": True,
    }

    if overrides:
        for key in ["developer_token", "client_id", "client_secret", "refresh_token", "login_customer_id"]:
            value = overrides.get(key)
            if value:
                credentials[key] = value

    credentials["login_customer_id"] = sanitize_customer_id(credentials.get("login_customer_id"))

    missing = [
        key for key in ["developer_token", "client_id", "client_secret", "refresh_token"]
        if not credentials.get(key)
    ]
    if missing:
        raise ValueError(f"Missing required credentials: {', '.join(missing)}")

    return credentials


# Initialize Google Ads client
def get_google_ads_client(overrides=None):
    credentials = build_credentials(overrides)
    return GoogleAdsClient.load_from_dict(credentials)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

@app.route('/generate-keyword-ideas', methods=['POST'])
def generate_keyword_ideas():
    try:
        data = request.json
        keywords = data.get('keywords', [])
        country = str(data.get('country', DEFAULT_COUNTRY))
        language = (data.get('language', DEFAULT_LANGUAGE) or DEFAULT_LANGUAGE).lower()

        if not keywords:
            return jsonify({"error": "No keywords provided"}), 400

        language_id = LANGUAGE_MAP.get(language, LANGUAGE_MAP.get('en', '1000'))

        client = get_google_ads_client()
        customer_id = sanitize_customer_id(os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID"))

        if not customer_id:
            raise ValueError("GOOGLE_ADS_LOGIN_CUSTOMER_ID is not configured")

        keyword_plan_idea_service = client.get_service("KeywordPlanIdeaService")
        google_ads_service = client.get_service("GoogleAdsService")

        # Use correct request format
        request_body = client.get_type("GenerateKeywordIdeasRequest")
        request_body.customer_id = customer_id

        # Set language resource name
        request_body.language = google_ads_service.language_constant_path(language_id)

        # Set geo target constants
        geo_target_constant = google_ads_service.geo_target_constant_path(country)
        request_body.geo_target_constants.append(geo_target_constant)

        request_body.include_adult_keywords = False
        request_body.keyword_plan_network = client.enums.KeywordPlanNetworkEnum.GOOGLE_SEARCH

        # API v21 limit: keyword_seed.keywords only supports 20 items
        # Batch keywords into groups of 20
        results = []
        min_search_volume = int(os.getenv("MIN_SEARCH_VOLUME", "10"))
        max_keywords = int(os.getenv("MAX_KEYWORDS", "500"))
        batch_size = 20

        print(f"[Python Service] Fetching keyword ideas for {len(keywords)} keywords in batches of {batch_size}, country: {country}, language: {language}")

        for i in range(0, len(keywords), batch_size):
            batch = keywords[i:i+batch_size]
            print(f"[Python Service] Processing batch {i//batch_size + 1}: {len(batch)} keywords")

            # Create new request for each batch
            batch_request = client.get_type("GenerateKeywordIdeasRequest")
            batch_request.customer_id = customer_id
            batch_request.language = google_ads_service.language_constant_path(language_id)
            batch_request.geo_target_constants.append(geo_target_constant)
            batch_request.include_adult_keywords = False
            batch_request.keyword_plan_network = client.enums.KeywordPlanNetworkEnum.GOOGLE_SEARCH
            batch_request.keyword_seed.keywords.extend(batch)

            response = keyword_plan_idea_service.generate_keyword_ideas(request=batch_request)

            for idea in response:
                metrics = idea.keyword_idea_metrics

                if metrics.avg_monthly_searches >= min_search_volume:
                    # Map competition enum to string
                    competition_map = {
                        0: 'unknown',
                        1: 'low',
                        2: 'medium',
                        3: 'high',
                    }
                    competition = competition_map.get(metrics.competition, 'unknown')

                    results.append({
                        "keyword": idea.text,
                        "searchVolume": int(metrics.avg_monthly_searches or 0),
                        "competition": competition,
                        "cpc": float(metrics.low_top_of_page_bid_micros / 1000000) if metrics.low_top_of_page_bid_micros else 0,
                        "cpcHigh": float(metrics.high_top_of_page_bid_micros / 1000000) if metrics.high_top_of_page_bid_micros else 0,
                    })

                if len(results) >= max_keywords:
                    break

            if len(results) >= max_keywords:
                print(f"[Python Service] Reached max keywords limit ({max_keywords})")
                break

        print(f"[Python Service] Successfully returned {len(results)} keywords")

        return jsonify({
            "success": True,
            "keywords": results,
            "total": len(results)
        }), 200

    except GoogleAdsException as ex:
        print(f"[Python Service] Google Ads API error: {ex}")
        error_message = f"Google Ads API error: {ex.error.code().name}"
        if ex.failure:
            error_message += f" - {ex.failure.errors[0].message}"
        return jsonify({"error": error_message}), 500

    except ValueError as e:
        print(f"[Python Service] Configuration error: {str(e)}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"[Python Service] Error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/test-credentials', methods=['POST'])
def test_credentials():
    try:
        data = request.json or {}
        credentials = data.get('credentials') or {}
        keywords = data.get('keywords') or ['test keyword']
        if not isinstance(keywords, list) or len(keywords) == 0:
            keywords = ['test keyword']

        country = str(data.get('country', DEFAULT_COUNTRY))
        language = (data.get('language', DEFAULT_LANGUAGE) or DEFAULT_LANGUAGE).lower()

        client = get_google_ads_client(credentials)
        customer_id = sanitize_customer_id(
            credentials.get('login_customer_id') or os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID")
        )

        if not customer_id:
            raise ValueError('login_customer_id is required to test credentials')

        keyword_plan_idea_service = client.get_service("KeywordPlanIdeaService")
        google_ads_service = client.get_service("GoogleAdsService")

        request_body = client.get_type("GenerateKeywordIdeasRequest")
        request_body.customer_id = customer_id
        language_id = LANGUAGE_MAP.get(language, LANGUAGE_MAP.get('en', '1000'))
        request_body.language = google_ads_service.language_constant_path(language_id)
        request_body.geo_target_constants.append(google_ads_service.geo_target_constant_path(country))
        request_body.include_adult_keywords = False
        request_body.keyword_plan_network = client.enums.KeywordPlanNetworkEnum.GOOGLE_SEARCH
        request_body.keyword_seed.keywords.extend(keywords[:10])

        response = keyword_plan_idea_service.generate_keyword_ideas(request=request_body)

        count = 0
        for _ in response:
            count += 1
            if count >= 1:
                break

        return jsonify({
            "success": True,
            "keywordsReturned": count
        }), 200

    except ValueError as error:
        print(f"[Python Service] Credential validation error: {str(error)}")
        return jsonify({"success": False, "error": str(error)}), 400
    except GoogleAdsException as ex:
        print(f"[Python Service] Google Ads credential test error: {ex}")
        error_message = f"Google Ads API error: {ex.error.code().name}"
        if ex.failure and ex.failure.errors:
            error_message += f" - {ex.failure.errors[0].message}"
        return jsonify({"success": False, "error": error_message}), 500
    except Exception as e:
        print(f"[Python Service] Unexpected credential test error: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PYTHON_SERVICE_PORT', 5000))
    print(f"[Python Service] Starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
