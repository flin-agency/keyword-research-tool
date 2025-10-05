from flask import Flask, request, jsonify
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Initialize Google Ads client
def get_google_ads_client():
    credentials = {
        "developer_token": os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN"),
        "client_id": os.getenv("GOOGLE_ADS_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_ADS_CLIENT_SECRET"),
        "refresh_token": os.getenv("GOOGLE_ADS_REFRESH_TOKEN"),
        "login_customer_id": os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID"),
        "use_proto_plus": True
    }
    return GoogleAdsClient.load_from_dict(credentials)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

@app.route('/generate-keyword-ideas', methods=['POST'])
def generate_keyword_ideas():
    try:
        data = request.json
        keywords = data.get('keywords', [])
        country = data.get('country', '2756')  # Switzerland
        language = data.get('language', 'de')  # German

        if not keywords:
            return jsonify({"error": "No keywords provided"}), 400

        # Language mapping
        language_map = {
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

        language_id = language_map.get(language, '1001')

        client = get_google_ads_client()
        customer_id = os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID")

        keyword_plan_idea_service = client.get_service("KeywordPlanIdeaService")

        # Use correct request format
        request_body = client.get_type("GenerateKeywordIdeasRequest")
        request_body.customer_id = customer_id

        # Set language resource name
        request_body.language = client.get_service("GoogleAdsService").language_constant_path(language_id)

        # Set geo target constants
        geo_target_constant = client.get_service("GoogleAdsService").geo_target_constant_path(country)
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
            batch_request.language = client.get_service("GoogleAdsService").language_constant_path(language_id)
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

    except Exception as e:
        print(f"[Python Service] Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PYTHON_SERVICE_PORT', 5000))
    print(f"[Python Service] Starting on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
