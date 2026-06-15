import xml.etree.ElementTree as ET
import urllib.request
import logging
from flask import Flask, jsonify, render_template

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)

@app.route('/')
def index():
    """Renders the main dashboard page."""
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    """Fetches and parses BigQuery release notes XML feed, returning JSON."""
    try:
        url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
        logging.info(f"Fetching release notes from {url}")
        
        # Define Request with User-Agent to avoid potential blocks
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}
        )
        
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            
        logging.info("Successfully fetched XML data. Parsing feed...")
        
        # Parse XML data
        root = ET.fromstring(xml_data)
        
        # Atom feed namespace mapping
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = []
        for entry in root.findall('atom:entry', ns):
            title_el = entry.find('atom:title', ns)
            updated_el = entry.find('atom:updated', ns)
            
            title = title_el.text if title_el is not None else "Unknown Date"
            updated = updated_el.text if updated_el is not None else ""
            
            # Find the alternate link (points to the actual release notes anchor)
            link = ""
            for l in entry.findall('atom:link', ns):
                if l.attrib.get('rel') == 'alternate':
                    link = l.attrib.get('href', '')
                    break
            if not link:
                first_link = entry.find('atom:link', ns)
                if first_link is not None:
                    link = first_link.attrib.get('href', '')
            
            content_elem = entry.find('atom:content', ns)
            content_html = content_elem.text if content_elem is not None else ""
            
            entries.append({
                'title': title,         # E.g. "June 15, 2026"
                'updated': updated,     # ISO timestamp
                'link': link,           # URL link
                'content': content_html # Embedded HTML updates
            })
            
        logging.info(f"Successfully parsed {len(entries)} release entries.")
        return jsonify({
            'success': True,
            'entries': entries
        })
        
    except ET.ParseError as pe:
        logging.error(f"XML parsing failed: {pe}")
        return jsonify({
            'success': False,
            'error': f"Failed to parse release notes feed XML: {str(pe)}"
        }), 500
    except Exception as e:
        logging.error(f"Error fetching release notes: {e}")
        return jsonify({
            'success': False,
            'error': f"An error occurred while fetching release notes: {str(e)}"
        }), 500

if __name__ == '__main__':
    # Start the Flask development server on port 5000
    app.run(host='127.0.0.1', port=5000, debug=True)
