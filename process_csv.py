#!/usr/bin/env python3
"""
处理CSV文件为JSON格式
处理文件：Bilibili_YYYYMMDD_ボカロOriginal&Cover.csv
输出：data/videos_YYYYMMDD.json
"""
import json
import csv
import os
import sys
from datetime import datetime
import glob

def convert_csv_to_json(csv_filepath):
    """将CSV文件转换为JSON格式"""
    videos = []
    
    try:
        with open(csv_filepath, 'r', encoding='utf-8-sig') as f:
            content = f.read()
            lines = content.splitlines()
            
            if not lines:
                print(f"CSV文件为空: {csv_filepath}")
                return []
            
            first_line = lines[0]
            if ',' in first_line and ';' not in first_line:
                delimiter = ','
            elif ';' in first_line and ',' not in first_line:
                delimiter = ';'
            elif '\t' in first_line:
                delimiter = '\t'
            else:
                delimiter = ','
            
            f.seek(0)
            
            reader = csv.DictReader(f, delimiter=delimiter)
            
            fieldname_mapping = {
                '发布时间': ['发布时间', '投稿时间', 'pubdate', 'Publish Time'],
                'BV号': ['BV号', 'BV', 'bvid', 'BV ID'],
                'AV号': ['AV号', 'AV', 'av号', 'aid', 'AV ID'],
                'aid': ['aid', 'AID'],
                '标题': ['标题', '视频标题', 'title', 'Title'],
                '作者': ['作者', 'UP主', '投稿人', 'author', 'Author'],
                '分类': ['分类', '类型', 'category', 'Category'],
                '标签': ['标签', 'tag', 'tags', 'Tags'],
                '点赞数': ['点赞数', '点赞', 'like', 'Like', 'likes'],
                '投币数': ['投币数', '硬币', 'coin', 'Coin', 'coins'],
                '收藏数': ['收藏数', '收藏', 'favorite', 'Favorite', 'favorites'],
                '分享数': ['分享数', '分享', 'share', 'Share', 'shares'],
                '播放量': ['播放量', '播放', 'view', 'View', 'views'],
                '弹幕数': ['弹幕数', '弹幕', 'danmaku', 'Danmaku', 'danmakus'],
                '评论数': ['评论数', '评论', 'reply', 'Reply', 'replies'],
                '时长': ['时长', '视频时长', 'duration', 'Duration'],
                '简介': ['简介', '描述', 'description', 'Description'],
                '标签数量': ['标签数量', '标签数', 'tag_count', 'Tag Count'],
                '原创性': ['原创性', '版权', 'copyright', 'Copyright'],
                '动态文案': ['动态文案', '动态', 'dynamic', 'Dynamic'],
                '子分区': ['子分区', '分区', 'subzone', 'Subzone']
            }
            
            for row in reader:
                video = {}
                
                for field in reader.fieldnames:
                    field_clean = field.strip().replace('\ufeff', '')
                    value = row[field].strip() if row[field] is not None else ''
                    
                    standard_field = None
                    for std_field, aliases in fieldname_mapping.items():
                        if field_clean in aliases:
                            standard_field = std_field
                            break
                    
                    if standard_field:
                        if standard_field in ['点赞数', '投币数', '收藏数', '分享数', 
                                            '播放量', '弹幕数', '评论数', '标签数量']:
                            try:
                                if value and value != '':
                                    video[standard_field] = int(float(value))
                                else:
                                    video[standard_field] = 0
                            except:
                                video[standard_field] = 0
                        else:
                            video[standard_field] = value
                    else:
                        video[field_clean] = value
                
                if '发布时间' not in video or not video['发布时间']:
                    print(f"警告：视频缺少发布时间: {video.get('标题', '未知标题')}")
                    continue
                
                if '分类' in video:
                    category = video['分类'].strip()
                    if category == '原创':
                        video['分类'] = 'Original'
                    elif category == '翻唱':
                        video['分类'] = 'Cover'
                    else:
                        video['分类'] = 'Other'
                else:
                    tags = video.get('标签', '')
                    if '原创' in tags or '原创曲' in tags or 'オリジナル' in tags:
                        video['分类'] = 'Original'
                    elif '翻唱' in tags or 'cover' in tags.lower() or 'カバー' in tags:
                        video['分类'] = 'Cover'
                    else:
                        video['分类'] = 'Other'
                
                if '原创性' in video:
                    if video['原创性'] in ['原创', '1', '原创作品']:
                        video['原创性'] = '原创'
                    else:
                        video['原创性'] = '转载'
                
                if 'AV号' in video and video['AV号']:
                    if not video['AV号'].startswith('AV'):
                        video['AV号'] = f"AV{video['AV号']}"
                
                if 'aid' not in video or not video['aid']:
                    if 'AV号' in video and video['AV号']:
                        av_str = video['AV号']
                        if av_str.startswith('AV'):
                            video['aid'] = av_str[2:]
                
                videos.append(video)
        
        videos.sort(key=lambda x: parse_datetime(x.get('发布时间', '')))
        
        return videos
        
    except Exception as e:
        print(f"转换CSV文件失败 {csv_filepath}: {e}")
        import traceback
        traceback.print_exc()
        return []

def parse_datetime(datetime_str):
    """解析时间字符串为timestamp"""
    if not datetime_str:
        return 0
    
    formats = [
        '%Y-%m-%d %H:%M:%S',
        '%Y/%m/%d %H:%M:%S',
        '%Y-%m-%d %H:%M',
        '%Y/%m/%d %H:%M',
        '%Y年%m月%d日 %H:%M:%S',
        '%Y年%m月%d日 %H:%M'
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(datetime_str, fmt)
            return dt.timestamp()
        except:
            continue
    
    return 0

def extract_date_from_filename(filename):
    """从文件名中提取日期"""
    # 格式：Bilibili_YYYYMMDD_ボカロOriginal&Cover.csv
    parts = filename.split('_')
    for part in parts:
        if len(part) == 8 and part.isdigit():
            try:
                dt = datetime.strptime(part, '%Y%m%d')
                return part, dt.strftime('%Y-%m-%d')
            except:
                continue
    
    return None, None

def process_all_csv_files():
    """处理所有CSV文件"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_dir = os.path.join(base_dir, "csv_data")
    output_dir = os.path.join(base_dir, "data")
    
    os.makedirs(csv_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    
    csv_files = glob.glob(os.path.join(csv_dir, "Bilibili_*.csv"))
    csv_files += glob.glob(os.path.join(csv_dir, "*.csv"))
    
    if not csv_files:
        print(f"未找到CSV文件，请将CSV文件放入 {csv_dir} 目录")
        return {}
    
    print(f"找到 {len(csv_files)} 个CSV文件")
    
    date_index = {}
    
    for csv_file in csv_files:
        filename = os.path.basename(csv_file)
        print(f"处理文件: {filename}")
        
        date_str, display_date = extract_date_from_filename(filename)
        
        if not date_str:
            print(f"  跳过：无法从文件名提取日期")
            continue
        
        videos = convert_csv_to_json(csv_file)
        
        if not videos:
            print(f"  警告：没有解析到视频数据")
            continue
        
        original_count = sum(1 for v in videos if v.get('分类') == 'Original')
        cover_count = sum(1 for v in videos if v.get('分类') == 'Cover')
        other_count = len(videos) - original_count - cover_count
        
        json_filename = f"videos_{date_str}.json"
        json_filepath = os.path.join(output_dir, json_filename)
        
        with open(json_filepath, 'w', encoding='utf-8') as f:
            json.dump(videos, f, ensure_ascii=False, indent=2)
        
        date_index[display_date] = {
            "date": date_str,
            "display_date": display_date,
            "filename": json_filename,
            "path": f"data/{json_filename}",
            "total_videos": len(videos),
            "original_count": original_count,
            "cover_count": cover_count,
            "other_count": other_count,
            "sort_key": date_str
        }
        
        print(f"  ✓ 转换完成: {len(videos)} 个视频")
        print(f"    Original: {original_count}, Cover: {cover_count}, Other: {other_count}")
    
    sorted_dates = sorted(date_index.items(), 
                         key=lambda x: x[1]["sort_key"], 
                         reverse=True)
    
    total_videos = 0
    total_original = 0
    total_cover = 0
    
    for date_info in date_index.values():
        total_videos += date_info["total_videos"]
        total_original += date_info["original_count"]
        total_cover += date_info["cover_count"]
    
    index_data = {
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_videos": total_videos,
        "total_original": total_original,
        "total_cover": total_cover,
        "total_days": len(date_index),
        "dates": {date: info for date, info in sorted_dates}
    }
    
    index_file = os.path.join(output_dir, "dates.json")
    with open(index_file, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ 索引文件已生成: {index_file}")
    print(f"  总计天数: {len(date_index)}")
    print(f"  总计视频: {total_videos}")
    print(f"  Original: {total_original}")
    print(f"  Cover: {total_cover}")
    
    return date_index

def create_test_data():
    """创建测试数据"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_dir = os.path.join(base_dir, "csv_data")
    os.makedirs(csv_dir, exist_ok=True)
    
    test_data = [
        {
            "发布时间": "2024-01-01 08:30:00",
            "BV号": "BV1Ab4y1a7Xc",
            "AV号": "AV170001",
            "aid": "170001",
            "标题": "【初音未来】TEST ORIGINAL SONG - 测试原创曲",
            "作者": "测试作者1",
            "分类": "Original",
            "标签": "初音未来,VOCALOID,原创曲,测试",
            "点赞数": "1234",
            "投币数": "567",
            "收藏数": "890",
            "分享数": "123",
            "播放量": "12345",
            "弹幕数": "234",
            "评论数": "345",
            "时长": "3:45",
            "简介": "这是一首测试原创曲",
            "标签数量": "4",
            "原创性": "原创",
            "动态文案": "新曲发布！",
            "子分区": "VOCALOID"
        },
        {
            "发布时间": "2024-01-01 12:45:00",
            "BV号": "BV1Cb4y1a7Xd",
            "AV号": "AV170002",
            "aid": "170002",
            "标题": "【洛天依】TEST COVER SONG - 测试翻唱",
            "作者": "测试作者2",
            "分类": "Cover",
            "标签": "洛天依,翻唱,cover,测试",
            "点赞数": "987",
            "投币数": "432",
            "收藏数": "321",
            "分享数": "54",
            "播放量": "8765",
            "弹幕数": "123",
            "评论数": "234",
            "时长": "4:20",
            "简介": "这是一首测试翻唱",
            "标签数量": "4",
            "原创性": "转载",
            "动态文案": "翻唱发布！",
            "子分区": "VOCALOID"
        },
        {
            "发布时间": "2024-01-01 15:20:00",
            "BV号": "BV1Db4y1a7Xe",
            "AV号": "AV170003",
            "aid": "170003",
            "标题": "【镜音铃】ANOTHER ORIGINAL SONG - 另一首原创",
            "作者": "测试作者3",
            "分类": "Original",
            "标签": "镜音铃,VOCALOID,原创曲",
            "点赞数": "2345",
            "投币数": "678",
            "收藏数": "901",
            "分享数": "234",
            "播放量": "23456",
            "弹幕数": "345",
            "评论数": "456",
            "时长": "4:15",
            "简介": "另一首测试原创曲",
            "标签数量": "3",
            "原创性": "原创",
            "动态文案": "第二首原创发布！",
            "子分区": "VOCALOID"
        }
    ]
    
    csv_filepath = os.path.join(csv_dir, "Bilibili_20240101_ボカロOriginal&Cover.csv")
    
    with open(csv_filepath, 'w', newline='', encoding='utf-8-sig') as f:
        fieldnames = [
            '发布时间', 'BV号', 'AV号', '标题', '作者', '分类', '标签',
            'aid', '点赞数', '投币数', '收藏数', '分享数', '播放量',
            '弹幕数', '评论数', '时长', '简介', '标签数量', '原创性', 
            '动态文案', '子分区'
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(test_data)
    
    print(f"测试CSV文件已创建: {csv_filepath}")
    return csv_filepath

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='处理B站CSV数据为JSON格式')
    parser.add_argument('--test', action='store_true', help='创建测试数据')
    parser.add_argument('--csv', type=str, help='处理单个CSV文件')
    
    args = parser.parse_args()
    
    if args.test:
        create_test_data()
        print("\n测试数据已创建，运行以下命令处理：")
        print("python process_csv.py")
    elif args.csv:
        if os.path.exists(args.csv):
            videos = convert_csv_to_json(args.csv)
            print(f"解析到 {len(videos)} 个视频")
            
            base_dir = os.path.dirname(os.path.abspath(__file__))
            output_dir = os.path.join(base_dir, "data")
            os.makedirs(output_dir, exist_ok=True)
            
            json_filepath = os.path.join(output_dir, "output.json")
            with open(json_filepath, 'w', encoding='utf-8') as f:
                json.dump(videos, f, ensure_ascii=False, indent=2)
            
            print(f"JSON文件已保存: {json_filepath}")
        else:
            print(f"文件不存在: {args.csv}")
    else:
        date_index = process_all_csv_files()
        if date_index:
            print("\n处理完成！现在可以：")
            print("1. 在浏览器中打开 index.html 查看数据")
            print("2. 运行 git add . && git commit -m 'update' && git push 推送到GitHub")